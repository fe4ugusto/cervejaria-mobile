# 🍻 Cervejaria Artesanal — Mobile

Aplicativo mobile desenvolvido em **React Native** com **Expo** para gestão de produtos, fornecedores e pedidos de uma cervejaria artesanal, contando com arquitetura offline-first, banco de dados local SQLite, nuvem com Firebase e integração com API externa.

---

## 📱 Funcionalidades

### 🔐 Autenticação e Controle de Acesso
- Cadastro e login de usuários via **Firebase Authentication** (e-mail/senha e autenticação social com Google).
- Controle de perfis:
  - **Administrador**: Acesso à gestão de cervejas, estilos, fornecedores e painel de sincronização.
  - **Cliente**: Acesso ao catálogo de produtos, carrinho de compras, cálculo de frete por CEP e histórico de pedidos.

### 📦 Gestão Operacional (Admin)
- **Cervejas**: Cadastro, listagem com busca, edição de informações técnicas (IBU, ABV, preço, estoque) e exclusão.
- **Estilos**: Gerenciamento de estilos cervejeiros (origem e nível de amargor).
- **Fornecedores**: Cadastro com consulta de CEP automática via API externa e controle de status (ativo/inativo).

### 🛒 Catálogo e Delivery (Cliente)
- Busca e filtragem rápida por estilos de cerveja.
- Carrinho de compras com controle de quantidade e validação de estoque em tempo real.
- Consulta de endereço de entrega através da API ViaCEP.
- Registro de pedidos e histórico de compras.

### 🔄 Arquitetura Offline-First & Sincronização
- **Banco Local (SQLite)**: Operações de leitura e escrita são salvas localmente via `expo-sqlite`, garantindo o funcionamento do aplicativo mesmo sem conexão à internet.
- **Banco em Nuvem (Cloud Firestore)**: Armazenamento centralizado dos dados.
- **Sincronização Automática**: Monitoramento de conectividade via NetInfo; ao restabelecer a conexão, alterações pendentes são sincronizadas bidirecionalmente com o Firestore.
- **Painel de Sincronização**: Visualização do status de conectividade em tempo real e total de registros locais/pendentes.

---

## 🛠️ Tecnologias Utilizadas

- **Framework**: [React Native](https://reactnative.dev/) com [Expo](https://expo.dev/) (SDK 58)
- **Linguagem**: JavaScript (ES6+)
- **Navegação**: [React Navigation](https://reactnavigation.org/) (Native Stack e Bottom Tabs)
- **Autenticação & Nuvem**: [Firebase](https://firebase.google.com/) (Authentication & Cloud Firestore)
- **Banco de Dados Local**: [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/)
- **Armazenamento de Estado Local**: [@react-native-async-storage/async-storage](https://react-native-async-storage.github.io/async-storage/)
- **Monitoramento de Rede**: [@react-native-community/netinfo](https://github.com/react-native-netinfo/react-native-netinfo)
- **API Externa**: [ViaCEP](https://viacep.com.br/) (Webservice REST)

---

## 📂 Estrutura do Projeto

```
cervejaria-mobile/
├── assets/                  # Ícones e splash screen
├── src/
│   ├── components/          # Componentes reutilizáveis (Header, etc.)
│   ├── config/              # Configurações do Firebase
│   ├── context/             # Contexto de Autenticação (AuthContext)
│   ├── database/            # Gerenciador SQLite e serviço de sincronização
│   ├── navigation/          # Navegação com controle de rotas por perfil
│   ├── screens/             # Telas do aplicativo (Admin, Cliente, Login, Sync)
│   ├── services/            # Serviços de API (ViaCEP)
│   └── theme/               # Paleta de cores e estilos globais
├── App.js                   # Componente raiz da aplicação
├── app.json                 # Configurações do Expo
└── package.json             # Dependências e scripts
```

---

## 🚀 Como Executar

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)
- Gerenciador de pacotes `npm` ou `yarn`
- Aplicativo **Expo Go** instalado no smartphone ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) ou [iOS](https://apps.apple.com/app/expo-go/id982107779))

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/fe4ugusto/cervejaria-mobile.git
cd cervejaria-mobile
```

2. Instale as dependências:
```bash
npm install
```

3. Inicie o servidor Expo:
```bash
npx expo start
```

4. No smartphone, abra o app **Expo Go** e escaneie o QR Code exibido no terminal.
*(Para rodar no navegador web, pressione a tecla `w` no terminal).*
