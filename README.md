# 🥗 AppCal — AI-Powered Nutrition & Calorie Tracker

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8.x-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini-8E75B2?logo=googlegemini&logoColor=white)](https://ai.google.dev/)

> **AppCal** é uma aplicação web progressiva moderna para registo e análise nutricional diária. Combina visão computacional com o modelo multimodal **Google Gemini** para estimar automaticamente calorias e macronutrientes a partir de fotos de refeições, além de permitir leitura de códigos de barras de alimentos e sincronização segura com o Supabase.

---

## ✨ Funcionalidades Principais

- 🤖 **Análise Nutricional com IA (Gemini)**: Tira ou envia uma foto do prato e a IA decompõe automaticamente os ingredientes, gramagens estimadas e macronutrientes (Calorias, Proteínas, Hidratos de Carbono e Gorduras).
- 📷 **Leitor de Código de Barras**: Scanner integrado para identificar produtos e obter valores nutricionais rapidamente.
- 📊 **Dashboard Diário & Metas**: Acompanhamento em tempo real de calorias consumidas vs. metas diárias, balanço de macros e progresso de peso corporal.
- ☁️ **Sincronização na Cloud (Supabase)**: Autenticação de utilizadores, Row Level Security (RLS) e persistência de histórico de refeições e pesos.
- 🌐 **Suporte Multilíngue (i18n)**: Suporte completo em Português e Inglês.
- ⚡ **Offline-Ready & PWA**: Armazenamento local rápido com Zustand e Service Worker para experiência fluida em dispositivos móveis.

---

## 🛠️ Stack Tecnológica

- **Frontend:** React 19, TypeScript, Vite
- **Estado Global:** Zustand
- **Backend & Autenticação:** Supabase (PostgreSQL + RLS + Auth)
- **Inteligência Artificial:** Google Gemini API (Multimodal Vision)
- **Leitor de Códigos de Barras:** `html5-qrcode`
- **Ícones & UI:** Lucide React, CSS Moderno com Dark Mode

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js (v18+)
- Conta no Supabase e chave da API do Google Gemini (opcional, inclui modo de demonstração)

### Passos
1. Clonar o repositório:
   ```bash
   git clone https://github.com/Bernas131113/AppCal.git
   cd AppCal
   ```
2. Instalar dependências:
   ```bash
   npm install
   ```
3. Configurar variáveis de ambiente criando um ficheiro `.env`:
   ```env
   VITE_SUPABASE_URL=tua_url_supabase
   VITE_SUPABASE_ANON_KEY=tua_chave_anon_supabase
   VITE_GEMINI_API_KEY=tua_chave_gemini
   ```
4. Iniciar o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
