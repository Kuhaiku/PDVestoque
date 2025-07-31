// Deixa a função no escopo global para o 'onclick' funcionar
function gerarImagem() {
    // Esconde o campo de input antes de gerar a imagem para um visual mais limpo
    const clienteInput = document.getElementById('cliente-nome');
    const clienteNome = clienteInput.value;
    const clienteDisplay = document.createElement('span');
    clienteDisplay.textContent = clienteNome;
    clienteInput.style.display = 'none';
    clienteInput.parentNode.insertBefore(clienteDisplay, clienteInput.nextSibling);

    html2canvas(document.querySelector("#capture")).then(canvas => {
        let link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = `recibo_${clienteNome.replace(/\s+/g, '_') || 'cliente'}.png`;
        link.click();
        
        // Mostra o campo de input novamente após gerar a imagem
        clienteInput.style.display = 'inline-block';
        clienteDisplay.remove();
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    // --- Dados da Empresa (podem ser alterados aqui) ---
    document.getElementById('header-contato').textContent = "Tel.: (22) 2665-5910";
    document.getElementById('header-endereco').textContent = "Rua Bernardo Vasconcelos 293 - sala 4A - Centro";
    document.getElementById('header-cnpj').textContent = "CNPJ: 12.689.177/0001-26 - Araruama/RJ";

    // --- Lógica para buscar e preencher dados do recibo ---
    const params = new URLSearchParams(window.location.search);
    const reciboId = params.get('id');

    if (!reciboId) {
        document.body.innerHTML = '<h1>Erro: ID do recibo não fornecido.</h1>';
        return;
    }

    try {
        const response = await fetch(`/api/recibos/${reciboId}`);
        if (!response.ok) throw new Error('Recibo não encontrado.');
        
        const recibo = await response.json();

        // Preenche as informações do cabeçalho do recibo
        document.getElementById('recibo-id').textContent = recibo.recibo_id.toString().padStart(5, '0');
        
        // ==================================================================
        // ALTERAÇÃO AQUI: Formatando a data manualmente como você sugeriu
        // ==================================================================
        const dataISO = recibo.data_recibo; // Ex: "2025-07-31T18:40:00.000Z"
        const apenasData = dataISO.substring(0, 10); // Pega apenas "2025-07-31"
        const partesData = apenasData.split('-'); // Divide em [ "2025", "07", "31" ]
        const dataFormatada = `${partesData[2]}/${partesData[1]}/${partesData[0]}`; // Monta como "31/07/2025"
        document.getElementById('recibo-data').textContent = dataFormatada;
        // ==================================================================

        document.getElementById('recibo-vendedor').textContent = recibo.usuario_nome;

        // Preenche a tabela com os itens da venda
        const itemsBody = document.querySelector('table tbody');
        itemsBody.innerHTML = ''; // Limpa a tabela antes de popular
        
        recibo.items.forEach(item => {
            const subtotal = item.quantidade * item.produto_valor_unitario;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.quantidade}</td>
                <td style="text-align: left;">${item.produto_nome}</td>
                <td style="text-align: right;">R$ ${Number(item.produto_valor_unitario).toFixed(2)}</td>
                <td style="text-align: right;">R$ ${subtotal.toFixed(2)}</td>
            `;
            itemsBody.appendChild(tr);
        });

        // Preenche o total geral
        document.getElementById('total-geral').textContent = Number(recibo.valor_total_recibo).toFixed(2);

    } catch (error) {
        document.body.innerHTML = `<h1>Erro ao carregar recibo: ${error.message}</h1>`;
    }
});