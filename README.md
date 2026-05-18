# Hábitos · Vini & Vic

App web (PWA) pra registrar diariamente exercícios e alimentação. Pensado pra ser
instalado na tela inicial do celular e usado como se fosse um app nativo.

Stack: HTML + CSS + JS puro (sem build) · Firebase Firestore · GitHub Pages.

---

## 1. Rodar localmente (sem Firebase)

Como o app usa ES modules (`import`), **abrir o arquivo direto com duplo clique
não funciona** — precisa servir via HTTP. Opções rápidas, escolha uma:

```bash
# Python (vem instalado no macOS)
cd GymProject
python3 -m http.server 5173

# ou Node, se preferir
npx serve .
```

Abra `http://localhost:5173` no navegador. Sem Firebase configurado, ele entra em
**modo local** — os dados ficam só no `localStorage` desse navegador (cada
celular tem seu próprio histórico, não sincroniza).

---

## 2. Configurar o Firebase (sincronização entre celulares)

### 2.1. Criar o projeto

1. Vá em <https://console.firebase.google.com> e clique em **Add project**.
2. Dê um nome (ex.: `habitos-vini-vic`). Pode pular o Google Analytics.
3. Quando o projeto for criado, na tela inicial, clique no ícone **`</>`**
   (Add app → Web).
4. Registre o app (qualquer apelido). **NÃO** marque "Firebase Hosting".
5. Vai aparecer um objeto `firebaseConfig`. Copie ele inteiro.

### 2.2. Colar as chaves

Abra `js/firebase-config.js` e substitua os campos `"COLE_AQUI"` pelos valores
do seu `firebaseConfig`. Exemplo:

```js
const firebaseConfig = {
  apiKey: "AIzaSyB...",
  authDomain: "habitos-vini-vic.firebaseapp.com",
  projectId: "habitos-vini-vic",
  storageBucket: "habitos-vini-vic.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

### 2.3. Criar o banco

No console do Firebase: **Build → Firestore Database → Create database**.

- Modo: pode começar em **Start in test mode** (libera leitura/escrita por 30
  dias). Depois ajuste as regras (próximo passo).
- Local: escolha `southamerica-east1` (São Paulo) pra menor latência.

### 2.4. Ajustar as regras de segurança

No Firestore, aba **Rules**, cole o conteúdo abaixo. Isso permite leitura/escrita
somente em documentos com IDs no formato `vinicius_*` ou `victoria_*`, evitando
que alguém aleatório possa escrever lixo no seu banco:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /days/{docId} {
      allow read, write: if docId.matches("^(vinicius|victoria)_\\d{4}-\\d{2}-\\d{2}$");
    }
  }
}
```

> Aviso: como não tem autenticação, qualquer um que descobrir as credenciais do
> seu projeto Firebase pode ler/escrever. Pra uso pessoal entre vocês dois isso
> é aceitável; se quiser blindagem real, adicione Firebase Auth (anônimo + uma
> lista de UIDs autorizados nas Rules).

---

## 3. Publicar no GitHub Pages

1. Crie um repositório no GitHub (público ou privado — Pages funciona em ambos
   se você tiver plano gratuito atual).
2. Suba os arquivos da pasta `GymProject`:

```bash
cd GymProject
git init
git add .
git commit -m "habitos: primeira versão"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPO.git
git push -u origin main
```

3. No GitHub, vá em **Settings → Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main` / pasta `/ (root)`
   - Save.

4. Em ~1 minuto o site fica disponível em
   `https://SEU_USUARIO.github.io/SEU_REPO/`.

> Se o repo for **privado**, GitHub Pages requer GitHub Pro. Pra repo público
> é grátis. Como as chaves do Firebase ficam no JS (são chaves de client, não
> são segredo de fato), publicar o repo público é normal — a segurança vem das
> Rules do Firestore.

---

## 4. Instalar no iPhone como PWA

1. Abra a URL do GitHub Pages no **Safari** (não Chrome — no iOS, só Safari
   instala PWA direito).
2. Toque no ícone de compartilhar (quadrado com seta pra cima).
3. Role e toque em **"Adicionar à Tela de Início"**.
4. Pronto — vira um ícone na home. Abre em tela cheia, sem barra do Safari.

No Android (Chrome), basta o "Adicionar à tela inicial" do menu.

---

## 5. Estrutura

```
GymProject/
├── index.html              # shell do app (tela perfil + 3 views)
├── manifest.webmanifest    # PWA manifest
├── service-worker.js       # cache offline
├── css/
│   └── style.css
├── icons/
│   └── icon.svg            # ícone único (SVG escala pra tudo)
└── js/
    ├── firebase-config.js  # ← preencher com suas chaves
    ├── storage.js          # camada Firestore / localStorage
    ├── app.js              # controle de views e perfil
    ├── tracker.js          # registro do dia
    ├── stats.js            # estatísticas
    └── calendar.js         # calendário mensal
```

### Modelo do dado (Firestore: coleção `days`)

ID do documento: `${userId}_${YYYY-MM-DD}` (ex.: `vinicius_2026-05-18`).

```ts
{
  userId: "vinicius" | "victoria",
  date: "YYYY-MM-DD",
  exercises: ("academia"|"corrida"|"yoga"|"jiujitsu"|"bicicleta")[],
  water:  "1L" | "1.5L" | "2L" | null,
  lunch:  "limpo" | "sujo" | null,
  dinner: "limpo" | "sujo" | null,
  updatedAt: Timestamp
}
```

---

## 6. Adicionar/remover categorias depois

- **Exercícios**: edite os botões em `index.html` (bloco `data-group="exercises"`)
  e os labels em `EX_LABELS` dentro de `js/stats.js` e `js/calendar.js`.
- **Quantidades de água ou refeições**: idem, basta acrescentar mais `.chip`
  dentro do `chip-grid` correspondente.

Como é tudo string-based, não precisa migrar nada no banco — os novos valores
simplesmente aparecem nos dias futuros.

---

## 7. Ícones PNG (opcional, melhora o "Adicionar à tela")

O SVG cobre 99% dos casos. Se quiser ícones PNG nítidos pra splash screen do
iOS, gere a partir do `icons/icon.svg` em <https://realfavicongenerator.net/>
ou outro gerador, e salve como `icons/icon-180.png`, `icons/icon-192.png` e
`icons/icon-512.png`. O `index.html` e `manifest.webmanifest` já apontam pra
esses caminhos.
