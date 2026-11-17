# Deploy automático para Firebase Hosting & Firestore Rules

O projeto utiliza o projeto Firebase **`campus-erp-84964`** (definido em `.firebaserc` e `firebase.json`), com publicação automática no GitHub Actions (`.github/workflows/firebase-deploy.yml`) a cada push na branch `main`.

## 1. Configurar o segredo no GitHub

1. Abre a [Consola Firebase](https://console.firebase.google.com/project/campus-erp-84964/settings/serviceaccounts/adminsdk) → **Configurações do projeto** → **Contas de serviço**.
2. Gera uma nova chave privada JSON (ou cria/seleciona uma conta de serviço com permissões de *Firebase Hosting Admin* e *Firebase Rules Admin*).
3. No repositório GitHub, vai a **Settings → Secrets and variables → Actions → New repository secret**.
4. Cria o segredo:
   - **Name**: `FIREBASE_SERVICE_ACCOUNT_CAMPUS_ERP_84964`
   - **Secret**: cola o conteúdo integral do ficheiro JSON da conta de serviço.

Se o segredo ainda não estiver configurado, o workflow executa na mesma a bateria de verificação (`i18n:report`, `tsc`, `oxlint`, `guard:ui`, testes e `vite build`) e avisa que o passo de deploy foi ignorado.

## 2. O que o workflow valida antes do deploy

1. `npm run i18n:report` — paridade nas 4 línguas (`pt-PT`, `pt-BR`, `es`, `en`).
2. `npm run check` — `tsc -b --noEmit`, `oxlint`, `guard:ui --strict`, Vitest (`src`), testes legados (`tests/planner.test.ts`) e `vite build` (`dist/`).
3. `firebase-tools deploy --only hosting,firestore:rules --project campus-erp-84964`.

## 3. Deploy manual local (opcional)

```bash
npm run check
npx firebase-tools login
npx firebase-tools deploy --only hosting,firestore:rules --project campus-erp-84964
```
