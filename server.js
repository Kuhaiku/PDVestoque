const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');

const app = express();
const PORT = 3000;

// ==================================================================
// ALTERAÇÃO AQUI: Adicionada a porta na configuração do DB
// ==================================================================
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'), // Adiciona a porta
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'estoque_db'
};
// ==================================================================


app.use(express.static('public'));
app.use(express.json());
app.use(session({ secret: 'seu-segredo-de-sessao-super-secreto', resave: false, saveUninitialized: true, cookie: { secure: false } }));

// --- O restante do código do server.js permanece o mesmo ---
// (código das rotas omitido para brevidade, mas deve estar aqui)
// --- Rotas de Autenticação ---
app.post('/api/login', async (req, res) => {
    const { nome } = req.body;
    const nomeUsuario = nome.toLowerCase();
    if (!nomeUsuario) return res.status(400).json({ success: false, message: 'O nome é obrigatório.' });
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        let [rows] = await connection.execute('SELECT * FROM usuarios WHERE nome = ?', [nomeUsuario]);
        let usuario = rows[0];
        if (!usuario) {
            const [result] = await connection.execute('INSERT INTO usuarios (nome) VALUES (?)', [nomeUsuario]);
            usuario = { id: result.insertId, nome: nomeUsuario };
        }
        req.session.usuario = usuario;
        res.json({ success: true, usuario: req.session.usuario });
    } catch (error) { console.error(error); res.status(500).json({ success: false, message: 'Erro de conexão com o banco de dados.' }); } finally { if(connection) await connection.end(); }
});
app.post('/api/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ success: false, message: 'Não foi possível fazer logout.' });
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logout realizado com sucesso.' });
    });
});
app.get('/api/session', (req, res) => {
    if (req.session.usuario) res.json({ loggedIn: true, usuario: req.session.usuario });
    else res.json({ loggedIn: false });
});

// --- Rotas de Produtos (CRUD) ---
app.get('/api/produtos', async (req, res) => {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute('SELECT * FROM produtos WHERE is_active = TRUE ORDER BY nome ASC');
        res.json(rows);
    } catch (error) { res.status(500).json({ success: false, message: 'Erro ao buscar produtos.' }); } finally { if(connection) await connection.end(); }
});
app.post('/api/produtos/entrada', async (req, res) => {
    const { nome, quantidade, valor, descricao } = req.body;
    const nomeProduto = nome.toLowerCase();
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();
        let [rows] = await connection.execute('SELECT * FROM produtos WHERE nome = ?', [nomeProduto]);
        if (rows.length > 0) await connection.execute('UPDATE produtos SET quantidade = quantidade + ?, valor = ?, descricao = ?, is_active = TRUE WHERE nome = ?', [quantidade, valor, descricao, nomeProduto]);
        else await connection.execute('INSERT INTO produtos (nome, quantidade, valor, descricao) VALUES (?, ?, ?, ?)', [nomeProduto, quantidade, valor, descricao]);
        await connection.commit();
        res.json({ success: true, message: 'Entrada de produto registrada!' });
    } catch (error) { if(connection) await connection.rollback(); res.status(500).json({ success: false, message: 'Erro ao registrar entrada.' }); } finally { if(connection) await connection.end(); }
});
app.put('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    const { nome, valor, descricao } = req.body;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('UPDATE produtos SET nome = ?, valor = ?, descricao = ? WHERE id = ?', [nome.toLowerCase(), valor, descricao, id]);
        res.json({ success: true, message: 'Produto atualizado!' });
    } catch (error) { res.status(500).json({ success: false, message: 'Erro ao atualizar produto.' }); } finally { if(connection) await connection.end(); }
});
app.delete('/api/produtos/:id', async (req, res) => {
    const { id } = req.params;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.execute('UPDATE produtos SET is_active = FALSE WHERE id = ?', [id]);
        res.json({ success: true, message: 'Produto excluído!' });
    } catch (error) { res.status(500).json({ success: false, message: 'Erro ao excluir produto.' }); } finally { if(connection) await connection.end(); }
});

// --- Rotas de Vendas ---
app.post('/api/vendas/finalizar', async (req, res) => {
    if (!req.session.usuario) return res.status(401).json({ success: false, message: 'Usuário não autenticado.' });
    const { items } = req.body;
    const { id: usuarioId } = req.session.usuario;
    if (!items || items.length === 0) return res.status(400).json({ success: false, message: 'O carrinho está vazio.' });
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        await connection.beginTransaction();
        let valorTotalRecibo = 0;
        for (const item of items) {
            const [rows] = await connection.execute('SELECT * FROM produtos WHERE id = ? AND is_active = TRUE FOR UPDATE', [item.produtoId]);
            const produto = rows[0];
            if (!produto || produto.quantidade < item.quantidade) throw new Error(`Estoque insuficiente para ${produto ? produto.nome : 'desconhecido'}.`);
            valorTotalRecibo += produto.valor * item.quantidade;
        }
        const [reciboResult] = await connection.execute('INSERT INTO recibos (usuario_id, valor_total_recibo) VALUES (?, ?)', [usuarioId, valorTotalRecibo]);
        const reciboId = reciboResult.insertId;
        for (const item of items) {
            await connection.execute('UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?', [item.quantidade, item.produtoId]);
            await connection.execute('INSERT INTO vendas (recibo_id, produto_id, quantidade) VALUES (?, ?, ?)', [reciboId, item.produtoId, item.quantidade]);
        }
        await connection.commit();
        res.json({ success: true, message: 'Venda finalizada com sucesso!', reciboId: reciboId });
    } catch (error) { if(connection) await connection.rollback(); res.status(500).json({ success: false, message: error.message }); } finally { if(connection) await connection.end(); }
});

// --- Rotas de Relatórios ---
app.get('/api/vendas', async (req, res) => {
    const query = `SELECT r.id AS recibo_id, r.data_recibo, r.valor_total_recibo, u.nome AS usuario_nome FROM recibos r JOIN usuarios u ON r.usuario_id = u.id ORDER BY r.data_recibo DESC;`;
    let connection;
    try { connection = await mysql.createConnection(dbConfig); const [rows] = await connection.execute(query); res.json(rows); } catch (error) { res.status(500).json({ success: false, message: 'Erro ao buscar relatório de vendas.' }); } finally { if(connection) await connection.end(); }
});
app.get('/api/recibos/:id', async (req, res) => {
    const { id } = req.params;
    const query = `SELECT r.id AS recibo_id, r.data_recibo, r.valor_total_recibo, u.nome AS usuario_nome, p.nome AS produto_nome, p.valor AS produto_valor_unitario, v.quantidade FROM recibos r JOIN usuarios u ON r.usuario_id = u.id JOIN vendas v ON v.recibo_id = r.id JOIN produtos p ON v.produto_id = p.id WHERE r.id = ?;`;
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        const [rows] = await connection.execute(query, [id]);
        if (rows.length === 0) return res.status(404).json({ success: false, message: 'Recibo não encontrado.' });
        const reciboDetails = {
            recibo_id: rows[0].recibo_id, data_recibo: rows[0].data_recibo, valor_total_recibo: rows[0].valor_total_recibo, usuario_nome: rows[0].usuario_nome,
            items: rows.map(item => ({ produto_nome: item.produto_nome, quantidade: item.quantidade, produto_valor_unitario: item.produto_valor_unitario }))
        };
        res.json(reciboDetails);
    } catch (error) { res.status(500).json({ success: false, message: 'Erro ao buscar detalhes do recibo.' }); } finally { if(connection) await connection.end(); }
});

app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));