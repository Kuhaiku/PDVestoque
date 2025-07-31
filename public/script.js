document.addEventListener('DOMContentLoaded', () => {
    // --- Seletores de Elementos ---
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const editModal = document.getElementById('edit-modal');
    const elements = {
        loginForm: document.getElementById('login-form'),
        usernameInput: document.getElementById('username'),
        userNameDisplay: document.getElementById('user-name-display'),
        logoutButton: document.getElementById('logout-button'),
        formEntrada: document.getElementById('form-entrada'),
        formAddCarrinho: document.getElementById('form-add-carrinho'),
        formEdit: document.getElementById('form-edit'),
        tabelaEstoqueBody: document.querySelector('#tabela-estoque tbody'),
        tabelaVendasBody: document.querySelector('#tabela-vendas tbody'),
        selectSaidaProduto: document.getElementById('saida-produto'),
        listaCarrinho: document.getElementById('lista-carrinho'),
        carrinhoTotalDisplay: document.getElementById('carrinho-total'),
        btnFinalizarVenda: document.getElementById('btn-finalizar-venda'),
        closeModalButton: document.querySelector('.close-button'),
        tabs: document.querySelectorAll('.tab-button'),
        tabContents: document.querySelectorAll('.tab-content'),
    };

    // --- Estado da Aplicação ---
    let carrinho = [];
    let produtosDisponiveis = [];

    // --- Funções da API ---
    async function apiRequest(url, options = {}) {
        try {
            const response = await fetch(url, options);
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `HTTP error! status: ${response.status}`);
            return data;
        } catch (error) {
            alert(`Erro: ${error.message}`);
            throw error;
        }
    }

    // --- Funções de UI ---
    const showSection = (section) => {
        loginContainer.classList.add('hidden');
        appContainer.classList.add('hidden');
        document.getElementById(`${section}-container`).classList.remove('hidden');
    };

    const refreshUI = async () => {
        await Promise.all([atualizarTabelaEstoque(), atualizarTabelaVendas()]);
    };

    async function atualizarTabelaEstoque() {
        produtosDisponiveis = await apiRequest('/api/produtos');
        elements.tabelaEstoqueBody.innerHTML = '';
        elements.selectSaidaProduto.innerHTML = '<option value="" disabled selected>-- Selecione um Produto --</option>';
        produtosDisponiveis.forEach(p => {
            elements.tabelaEstoqueBody.innerHTML += `<tr><td>${p.nome}</td><td>${p.quantidade}</td><td>R$ ${Number(p.valor).toFixed(2)}</td><td>${p.descricao || ''}</td><td class="action-buttons"><button class="edit-btn" data-id="${p.id}">Editar</button><button class="delete-btn" data-id="${p.id}">Excluir</button></td></tr>`;
            if (p.quantidade > 0) {
                elements.selectSaidaProduto.innerHTML += `<option value="${p.id}">${p.nome} (Qtd: ${p.quantidade})</option>`;
            }
        });
    }

    async function atualizarTabelaVendas() {
        const recibos = await apiRequest('/api/vendas');
        elements.tabelaVendasBody.innerHTML = '';
        recibos.forEach(r => {
            elements.tabelaVendasBody.innerHTML += `<tr><td>${new Date(r.data_recibo).toLocaleString('pt-BR')}</td><td>${r.recibo_id}</td><td>R$ ${Number(r.valor_total_recibo).toFixed(2)}</td><td>${r.usuario_nome}</td><td><button class="print-btn" data-id="${r.recibo_id}">Imprimir</button></td></tr>`;
        });
    }

    // --- Lógica do Modal ---
    const openEditModal = (produto) => {
        elements.formEdit.querySelector('#edit-id').value = produto.id;
        elements.formEdit.querySelector('#edit-nome').value = produto.nome;
        elements.formEdit.querySelector('#edit-valor').value = produto.valor;
        elements.formEdit.querySelector('#edit-desc').value = produto.descricao;
        editModal.classList.remove('hidden');
    };
    const closeEditModal = () => editModal.classList.add('hidden');

    // --- Lógica do Carrinho ---
    const adicionarAoCarrinho = (e) => {
        e.preventDefault();
        const produtoId = parseInt(elements.selectSaidaProduto.value);
        const quantidade = parseInt(document.getElementById('saida-qtd').value);
        if (!produtoId || !quantidade) return alert('Selecione um produto e uma quantidade.');

        const produto = produtosDisponiveis.find(p => p.id === produtoId);
        const itemExistente = carrinho.find(item => item.produtoId === produtoId);
        const qtdNoCarrinho = itemExistente ? itemExistente.quantidade : 0;
        
        if (quantidade > (produto.quantidade - qtdNoCarrinho)) return alert('Estoque insuficiente para adicionar essa quantidade.');
        
        if (itemExistente) itemExistente.quantidade += quantidade;
        else carrinho.push({ produtoId, nome: produto.nome, quantidade, valorUnitario: produto.valor });
        
        elements.formAddCarrinho.reset();
        atualizarVisualizacaoCarrinho();
    };

    const removerDoCarrinho = (produtoId) => {
        carrinho = carrinho.filter(item => item.produtoId !== produtoId);
        atualizarVisualizacaoCarrinho();
    };
    
    // ATUALIZADO: para incluir campo de input na quantidade
    const atualizarVisualizacaoCarrinho = () => {
        elements.listaCarrinho.innerHTML = '';
        let total = 0;
        carrinho.forEach(item => {
            total += item.quantidade * item.valorUnitario;
            elements.listaCarrinho.innerHTML += `
                <li>
                    <input type="number" class="cart-item-qty" value="${item.quantidade}" data-id="${item.produtoId}" min="1">
                    <span class="item-info">x ${item.nome}</span>
                    <span class="item-subtotal">R$ ${(item.quantidade * item.valorUnitario).toFixed(2)}</span>
                    <button class="remove-item-btn" data-id="${item.produtoId}">&times;</button>
                </li>`;
        });
        elements.carrinhoTotalDisplay.textContent = `R$ ${total.toFixed(2)}`;
    };

    // --- Event Handlers ---
    const handleLogin = async (e) => { e.preventDefault(); const data = await apiRequest('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: elements.usernameInput.value }) }); if (data.success) { elements.userNameDisplay.textContent = data.usuario.nome; showSection('app'); await refreshUI(); } };
    const handleLogout = async () => { await apiRequest('/api/logout', { method: 'POST' }); showSection('login'); elements.loginForm.reset(); };
    const handleEntrada = async (e) => { e.preventDefault(); const data = { nome: document.getElementById('entrada-nome').value, quantidade: parseInt(document.getElementById('entrada-qtd').value), valor: parseFloat(document.getElementById('entrada-valor').value), descricao: document.getElementById('entrada-desc').value }; await apiRequest('/api/produtos/entrada', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); elements.formEntrada.reset(); await refreshUI(); };
    const handleFinalizarVenda = async () => { if (carrinho.length === 0) return alert('O carrinho está vazio.'); const itemsParaAPI = carrinho.map(({ produtoId, quantidade }) => ({ produtoId, quantidade })); const data = await apiRequest('/api/vendas/finalizar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: itemsParaAPI }) }); if (data.success) { carrinho = []; atualizarVisualizacaoCarrinho(); await refreshUI(); if (window.confirm(data.message + "\nDeseja gerar o recibo agora?")) { window.open(`/recibo.html?id=${data.reciboId}`, '_blank'); } } };
    const handleEditFormSubmit = async (e) => { e.preventDefault(); const id = elements.formEdit.querySelector('#edit-id').value; const data = { nome: elements.formEdit.querySelector('#edit-nome').value, valor: parseFloat(elements.formEdit.querySelector('#edit-valor').value), descricao: elements.formEdit.querySelector('#edit-desc').value }; await apiRequest(`/api/produtos/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); closeEditModal(); await refreshUI(); };
    
    // --- Event Delegation e Listeners ---
    elements.loginForm.addEventListener('submit', handleLogin);
    elements.logoutButton.addEventListener('click', handleLogout);
    elements.formEntrada.addEventListener('submit', handleEntrada);
    elements.formAddCarrinho.addEventListener('submit', adicionarAoCarrinho);
    elements.btnFinalizarVenda.addEventListener('click', handleFinalizarVenda);
    elements.formEdit.addEventListener('submit', handleEditFormSubmit);
    elements.closeModalButton.addEventListener('click', closeEditModal);

    // Event Delegation para botões de clique
    document.body.addEventListener('click', async (e) => {
        if (e.target.classList.contains('edit-btn')) openEditModal(produtosDisponiveis.find(p => p.id === parseInt(e.target.dataset.id)));
        else if (e.target.classList.contains('delete-btn')) { if (confirm('Tem certeza?')) { await apiRequest(`/api/produtos/${e.target.dataset.id}`, { method: 'DELETE' }); await refreshUI(); } } 
        else if (e.target.classList.contains('remove-item-btn')) removerDoCarrinho(parseInt(e.target.dataset.id));
        else if (e.target.classList.contains('print-btn')) window.open(`/recibo.html?id=${e.target.dataset.id}`, '_blank');
    });

    // NOVO: Event Delegation para o input de quantidade no carrinho
    document.body.addEventListener('input', (e) => {
        if (e.target.classList.contains('cart-item-qty')) {
            const produtoId = parseInt(e.target.dataset.id);
            let novaQuantidade = parseInt(e.target.value);

            const itemNoCarrinho = carrinho.find(item => item.produtoId === produtoId);
            const produtoEmEstoque = produtosDisponiveis.find(p => p.id === produtoId);

            // Validação de estoque
            if (novaQuantidade > produtoEmEstoque.quantidade) {
                alert(`Estoque insuficiente. Máximo disponível: ${produtoEmEstoque.quantidade}`);
                e.target.value = itemNoCarrinho.quantidade; // Reverte para a quantidade anterior
                return;
            }
            
            // Validação de quantidade mínima
            if (isNaN(novaQuantidade) || novaQuantidade < 1) {
                novaQuantidade = 1;
                e.target.value = 1;
            }
            
            itemNoCarrinho.quantidade = novaQuantidade;
            atualizarVisualizacaoCarrinho(); // Re-renderiza o carrinho com os novos valores e totais
        }
    });

    elements.tabs.forEach(tab => { tab.addEventListener('click', () => { elements.tabs.forEach(t => t.classList.remove('active')); tab.classList.add('active'); elements.tabContents.forEach(content => content.classList.remove('active')); document.getElementById(tab.dataset.target).classList.add('active'); }); });

    // --- Inicialização ---
    const checkSession = async () => { try { const data = await apiRequest('/api/session'); if (data.loggedIn) { elements.userNameDisplay.textContent = data.usuario.nome; showSection('app'); await refreshUI(); } else { showSection('login'); } } catch (error) { showSection('login'); } };
    checkSession();
});