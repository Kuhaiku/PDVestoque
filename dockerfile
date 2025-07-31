# Etapa 1: Usar uma imagem base oficial e leve do Node.js
FROM node:20-alpine

# Etapa 2: Definir o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Etapa 3: Copiar os arquivos de dependência e instalar
# Copia package.json e package-lock.json para aproveitar o cache do Docker
COPY package*.json ./
RUN npm install --only=production

# Etapa 4: Copiar o restante do código da aplicação
# O .dockerignore garantirá que node_modules local não seja copiado
COPY . .

# Etapa 5: Expor a porta que a aplicação usa dentro do container
EXPOSE 3000

# Etapa 6: Comando para iniciar a aplicação quando o container rodar
CMD [ "node", "server.js" ]