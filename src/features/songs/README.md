# Songs Feature Module

Módulo responsável pelo upload e gerenciamento de músicas com conversão automática de áudio e persistência de metadados em transações Firestore.

## Funcionalidades

### 1. Upload de Música
- Aceita arquivos de áudio (MP3, WAV, OGG, WebM, AAC, FLAC, M4A, WMA, Opus) ou vídeo (MP4, WebM, MOV)
- Automaticamente converte o arquivo para formato MP3 padrão
- Valida metadados usando Zod schema (title, author)
- Realiza operações em transação atômica Firestore

### 2. Armazenamento
- **Firestore**: Documento com metadados em `/users/{userId}/songs/{songId}`
  - `title`: Título da música
  - `author`: Artista/Autor
  - `rawSongInfo`: Objeto com informações do arquivo raw
    - `url`: URL assinada do arquivo no Storage (válida por 7 dias)
    - `uploadedAt`: Timestamp do upload (gerado pelo servidor)
  - `status`: Estado do processamento ('processing' → 'ready')
  - `format`: Formato final ('mp3')

- **Firebase Storage**: Arquivo convertido em `/users/{userId}/songs/{songId}/raw.mp3`

## Arquitetura

```
src/features/songs/
├── songs.module.ts              # Módulo NestJS
├── songs.controller.ts          # HTTP endpoints
├── songs.service.ts             # Lógica de negócio
├── dtos/
│   └── upload-song.dto.ts      # Schemas Zod + tipos
├── utils/
│   └── audio-conversion.util.ts # Conversão FFmpeg
└── index.ts                      # Exportações públicas
```

## Endpoints

### 1. Upload de Música
```http
POST /songs/upload
Content-Type: multipart/form-data
Authorization: <Firebase Auth Token>

file: <arquivo de áudio/vídeo>
metadata: {"title": "Song Name", "author": "Artist Name"}
```

**Resposta (201 Created):**
```json
{
  "success": true,
  "data": {
    "songId": "abc123",
    "title": "Song Name",
    "author": "Artist Name",
    "rawSongInfo": {
      "url": "https://storage.googleapis.com/...",
      "uploadedAt": "2026-02-26T10:30:00.000Z"
    }
  }
}
```

### 2. Obter Música por ID
```http
GET /songs/:songId
Authorization: <Firebase Auth Token>
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "abc123",
    "title": "Song Name",
    "author": "Artist Name",
    "rawSongInfo": {
      "url": "https://storage.googleapis.com/...",
      "uploadedAt": "2026-02-26T10:30:00.000Z"
    },
    "status": "ready",
    "format": "mp3"
  }
}
```

### 3. Listar Músicas do Usuário
```http
GET /songs
Authorization: <Firebase Auth Token>
```

**Resposta (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "abc123",
      "title": "Song Name",
      "author": "Artist Name",
      "rawSongInfo": {
        "url": "https://storage.googleapis.com/...",
        "uploadedAt": "2026-02-26T10:30:00.000Z"
      },
      "status": "ready",
      "format": "mp3"
    }
  ],
  "total": 1
}
```

### 4. Deletar Música
```http
DELETE /songs/:songId
Authorization: <Firebase Auth Token>
```

Deleta a música e seu arquivo associado do Cloud Storage.

**Resposta (200 OK):**
```json
{
  "success": true,
  "message": "Song deleted successfully"
}
```

**Erros:**
- `404 Not Found`: Música não existe
- `500 Internal Server Error`: Erro ao deletar arquivo/documento

## Validação com Zod

O módulo valida automaticamente os metadados da música:

```typescript
{
  title: string    // 1-255 caracteres
  author: string   // 1-255 caracteres
}
```

Erros de validação retornam `400 Bad Request`:
```json
{
  "statusCode": 400,
  "message": "Invalid song data: Title is required; Author must be at most 255 characters"
}
```

## Conversão de Áudio

Utiliza FFmpeg para converter automaticamente para MP3:

- **Input**: MP3, WAV, OGG, WebM, MP4, MOV, AAC, FLAC, M4A, WMA, Opus
- **Output**: MP3 (128 kbps, 44.1 kHz, 2 canais)
- **Armazenamento**: `/users/{userId}/songs/{songId}/raw.mp3`

### Formatos Suportados

**Áudio:**
- MP3
- WAV
- OGG
- WebM
- AAC
- FLAC
- M4A
- WMA
- Opus

**Vídeo (extrai áudio):**
- MP4
- WebM
- MOV

## Transações Firestore

Todas as operações são executadas em transações atômicas para garantir consistência:

1. ✅ Criação do documento Firestore com metadados
2. ✅ Upload do arquivo convertido no Storage
3. ✅ Geração de URL assinada
4. ✅ Atualização do documento com URL do Storage
5. ❌ Se qualquer etapa falhar, toda a transação é reversão

**Benefícios:**
- Não há documentos orfãos sem arquivo
- Não há arquivos orfãos sem documento
- Consistência garantida entre Firestore e Storage

## Configuração

### Variáveis de Ambiente

```env
# Firebase
FIREBASE_SERVICE_ACCOUNT_JSON=<credentials.json>
GOOGLE_APPLICATION_CREDENTIALS=<path/to/credentials.json>

# Storage
FIREBASE_STORAGE_BUCKET=<project-id>.appspot.com
```

### Permissões Firestore/Storage

```
# firestore.rules
match /users/{userId}/songs/{document=**} {
  allow read, write: if request.auth.uid == userId;
}

# storage.rules
match /users/{userId}/songs/{allPaths=**} {
  allow read, write: if request.auth.uid == userId;
}
```

## Tratamento de Erros

| Erro | Código | Causa |
|------|--------|-------|
| `Invalid song data` | 400 | Metadados não passaram na validação Zod |
| `Unsupported file format` | 400 | Formato do arquivo não é suportado |
| `File is required` | 400 | Nenhum arquivo foi enviado |
| `Metadata JSON is required` | 400 | Campo 'metadata' está vazio |
| `User authentication required` | 400 | Token Firebase ausente ou inválido |
| `Failed to upload song` | 500 | Erro durante conversão, storage ou Firestore |
| `Failed to fetch song` | 500 | Erro ao buscar documento |
| `Failed to list songs` | 500 | Erro ao listar músicas do usuário |

## Exemplo de Uso (Client)

### JavaScript/TypeScript

```typescript
const uploadSong = async (file: File, title: string, author: string, authToken: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('metadata', JSON.stringify({ title, author }));

  const response = await fetch('/songs/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message);
  }

  return response.json();
};
```

### cURL

```bash
curl -X POST http://localhost:5001/songs/upload \
  -H "Authorization: Bearer <firebase-token>" \
  -F "file=@music.mp3" \
  -F 'metadata={"title":"My Song","author":"My Name"}'
```

## Desenvolvimento Local

### Rodando os Testes

```bash
# Todos os testes
npm test

# Apenas testes de songs
npm test -- features/songs

# Modo watch
npm test:watch
```

### Rodando o Servidor Local

```bash
npm run dev
```

Acesso: `http://localhost:5001`

### Emulador Firebase

```bash
npm run serve
```

## Próximas Melhorias

- [ ] Processamento assíncrono com Cloud Tasks (para arquivos maiores)
- [ ] Normalização de metadados (ID3 tags)
- [ ] Detecção automática de BPM
- [ ] Separação automática de voz/instrumental
- [ ] Caching de URLs assinadas
- [ ] Limite de tamanho de arquivo configurável
- [ ] Compressão de áudio adaptativa baseada em dispositivo
- [ ] Suporte a múltiplas versões de qualidade (bitrates)

## Monitoramento

Logs importantes para monitoramento:

```
[SongsService] Song upload initiated...
[SongsService] Converting audio (mp4) to MP3 for user <id>
[SongsService] File uploaded to users/<id>/songs/<id>/raw.mp3
[SongsService] Song uploaded successfully. User: <id>, Song ID: <id>
[SongsService] Song upload failed for user <id>: <error>
```

## Troubleshooting

### FFmpeg não encontrado
- Instale FFmpeg: `brew install ffmpeg` (macOS) ou `choco install ffmpeg` (Windows)
- Configure o caminho manualmente se necessário

### Erro de permissão no Storage
- Verifique as regras de segurança do Firebase Storage
- Confirme que `FIREBASE_STORAGE_BUCKET` está configurado

### Erro de transação Firestore
- Limite de 500 operações por transação não foi ultrapassado (improvável)
- Tente novamente; pode ser erro temporário de conectividade

## Referências

- [Firebase Admin SDK - Firestore](https://firebase.google.com/docs/firestore)
- [Firebase Admin SDK - Storage](https://firebase.google.com/docs/storage)
- [Zod Documentation](https://zod.dev)
- [NestJS File Upload](https://docs.nestjs.com/techniques/file-upload)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
