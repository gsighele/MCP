# Jina AI Remote MCP Server - README

Un server Model Context Protocol (MCP) remoto che fornisce accesso alle API Jina Reader, Embeddings e Reranker con una suite di strumenti per la conversione URL-to-markdown, ricerca web, ricerca immagini e strumenti di embeddings/reranker.

## Strumenti Disponibili

| Strumento | Descrizione | Richiede API Key Jina? |
|-----------|-------------|-----------------------|
| primer | Ottenere informazioni contestuali attuali per risposte localizzate e consapevoli del tempo | No |
| read_url | Estrarre contenuto pulito e strutturato da pagine web come markdown tramite Reader API | Opzionale* |
| capture_screenshot_url | Catturare screenshot di alta qualità di pagine web tramite Reader API | Opzionale* |
| guess_datetime_url | Analizzare pagine web per data/ora di ultimo aggiornamento/pubblicazione con punteggi di confidenza | No |
| search_web | Cercare nell'intero web per informazioni attuali e notizie tramite Reader API | Sì |
| search_arxiv | Cercare documenti accademici e preprint nel repository arXiv tramite Reader API | Sì |
| search_images | Cercare immagini sul web (simile a Google Images) tramite Reader API | Sì |
| expand_query | Espandere e riscrivere query di ricerca basate sul modello di espansione query tramite Reader API | Sì |
| parallel_read_url | Leggere più pagine web in parallelo per estrazione efficiente del contenuto tramite Reader API | Opzionale* |
| parallel_search_web | Eseguire più ricerche web in parallelo per copertura completa dell'argomento e prospettive diverse tramite Reader API | Sì |
| parallel_search_arxiv | Eseguire più ricerche arXiv in parallelo per copertura completa della ricerca e angoli accademici diversi tramite Reader API | Sì |
| sort_by_relevance | Riordinare documenti per rilevanza rispetto a una query tramite Reranker API | Sì |
| deduplicate_strings | Ottenere le top-k stringhe semanticamente uniche tramite Embeddings API e ottimizzazione submodulare | Sì |
| deduplicate_images | Ottenere le top-k immagini semanticamente uniche tramite Embeddings API e ottimizzazione submodulare | Sì |

*Gli strumenti opzionali funzionano senza una API key ma hanno limiti di rate. Per limiti di rate più elevati e prestazioni migliori, usa una API key Jina. Puoi ottenere una API key Jina gratuita da [https://jina.ai/](https://jina.ai/)

## Uso

### Per client che supportano server MCP remoti:

```json
{
  "mcpServers": {
    "jina-mcp-server": {
      "url": "https://mcp.jina.ai/sse",
      "headers": {
        "Authorization": "Bearer ${JINA_API_KEY}"
        // opzionale
      }
    }
  }
}
```

### Per client che non supportano ancora server MCP remoti:

Hai bisogno di `mcp-remote`, un proxy locale per connettersi al server MCP remoto.

```json
{
  "mcpServers": {
    "jina-mcp-server": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://mcp.jina.ai/sse",
        "--header",
        "Authorization: Bearer ${JINA_API_KEY}"
      ]
    }
  }
}
```

### Per Claude Code:

```bash
claude mcp add --transport sse jina https://mcp.jina.ai/sse \
  --header "Authorization: Bearer ${JINA_API_KEY}"
```

### Per OpenAI Codex:

Trova `~/.codex/config.toml` e aggiungi:

```toml
[mcp_servers.jina-mcp-server]
command = "npx"
args = [
  "-y",
  "mcp-remote",
  "https://mcp.jina.ai/sse",
  "--header",
  "Authorization: Bearer ${JINA_API_KEY}"
]
```

## Risoluzione Problemi

### Mi sono bloccato in un loop di chiamate di strumento - cosa è successo?

Questo è un problema comune con LMStudio quando la finestra di contesto predefinita è 4096 e stai usando un modello pensante come `gpt-oss-120b` o `qwen3-4b-thinking`. Man mano che il ragionamento e le chiamate di strumento continuano, una volta raggiunto il limite della finestra di contesto, l'AI inizia a perdere traccia dell'inizio del compito. Così rimane intrappolata in questa finestra di contesto scorrevole.

La soluzione è caricare il modello con una lunghezza di contesto sufficiente per contenere l'intera catena di chiamate di strumento e il processo di pensiero.

### Non riesco a vedere tutti gli strumenti.

Alcuni client MCP hanno cache locali e non aggiornano attivamente le definizioni degli strumenti. Se non vedi tutti gli strumenti disponibili o se gli strumenti sembrano obsoleti, potrebbe essere necessario rimuovere e ri-aggiungere jina-mcp-server alla configurazione del client MCP. Questo forzerà il client ad aggiornare le sue definizioni di strumenti in cache. In LMStudio, puoi cliccare il pulsante refresh per caricare nuovi strumenti.

### Claude Desktop dice "Server disconnected" su Windows

Cursor e Claude Desktop (Windows) hanno un bug dove gli spazi all'interno degli args non vengono escaped quando invoca npx, finendo per manomettere questi valori. Puoi aggirarlo usando:

```json
{
  // resto della configurazione...
  "args": [
    "mcp-remote",
    "https://mcp.jina.ai/sse",
    "--header",
    "Authorization:${AUTH_HEADER}"
    // nota nessuno spazio attorno a ':'
  ],
  "env": {
    "AUTH_HEADER": "Bearer ${JINA_API_KEY}"
    // spazi OK nelle variabili env
  }
}
```

### Cursor mostra un punto rosso su questo stato MCP

Probabilmente è un bug UI di Cursor, ma l'MCP funziona correttamente senza problemi. Puoi attivare/disattivare per "riavviare" l'MCP se trovi fastidioso il punto rosso (il fatto è che, dato che stai usando questo come MCP remoto, non è un vero "restart del server" ma principalmente un restart del proxy locale).

### Il mio LLM non usa mai alcuni strumenti

Supponendo che tutti gli strumenti siano abilitati nel tuo client MCP ma il tuo LLM non usa mai alcuni strumenti, è probabile che il tuo LLM favorisca alcuni strumenti rispetto ad altri, il che è abbastanza comune quando un LLM è addestrato con un set specifico di strumenti. Per esempio, raramente vediamo gli strumenti `parallel_*` essere usati organicamente dagli LLM a meno che non vengano esplicitamente istruiti a farlo. Alcune ricerche dicono che gli LLM devono essere addestrati per usare `parallel_*`.

In Cursor, puoi aggiungere la seguente regola al tuo file `.mdc`:

```
--- alwaysApply: true ---
Quando sei incerto sulla conoscenza, o l'utente dubita della tua risposta, usa sempre gli strumenti Jina MCP per cercare e leggere le migliori pratiche e le informazioni più recenti. Usa search_arxiv e read_url insieme quando le domande riguardano deep learning teorico o dettagli algoritmici. search_web e search_arxiv non possono essere usati da soli - combina sempre con read_url o parallel_read_url per leggere da più fonti. Ricorda: ogni ricerca deve essere completata con read_url per leggere il contenuto dell'URL sorgente. Per la massima efficienza, usa le versioni parallel_* di search e read quando necessario.
```

## Guida per Sviluppatori

### Sviluppo Locale

```bash
# Clona il repository
git clone https://github.com/jina-ai/MCP.git
cd MCP

# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run start
```

### Deploy su Cloudflare Workers

Questo farà il deploy del tuo server MCP su un URL come: `jina-mcp-server.<USERNAME>.workers.dev/sse`

## Link Originale

Repositorio GitHub: [https://github.com/jina-ai/MCP/blob/main/README.md](https://github.com/jina-ai/MCP/blob/main/README.md)
