# Ed live search - setup

Ed can answer questions about current news and facts. Those answers come from a
small server (this folder), because the API key must stay secret. The website
itself is static, so it cannot hold a key safely.

Turning this on costs money: each question uses the AI model and web search,
billed by the provider. Check the provider's current prices first.

## What you need

- A free Cloudflare account (workers.cloudflare.com)
- An Anthropic API key (console.anthropic.com)
- Node.js installed on your computer (for the Wrangler tool)

## Steps

1. Open a terminal in this `ai-proxy` folder.
2. Edit `wrangler.toml` and set `ALLOWED_ORIGIN` to your website address,
   for example `https://yourname.github.io` (the address only, no `/edutrack` path).
3. Install and sign in to the Cloudflare tool:

   ```
   npx wrangler login
   ```

4. Store your API key as a secret. It is never written to a file:

   ```
   npx wrangler secret put ANTHROPIC_API_KEY
   ```

5. Deploy:

   ```
   npx wrangler deploy
   ```

   Wrangler prints an address such as `https://edutrack-ed.yourname.workers.dev`.

6. Open `js/data.js` in the website folder and set the endpoint:

   ```js
   ai: { endpoint: 'https://edutrack-ed.yourname.workers.dev' },
   ```

7. Upload the updated `js/data.js` to your website (for example, to GitHub Pages).

## Test it

Sign in, open Ask Ed, and ask something current, such as
"what is the latest news on the Internet?". Ed should answer and name a source.
Questions about your own courses and tasks are still answered from your data.

## Privacy

- Only the question and a one-line summary (today's date, number of courses and
  open tasks) are sent. Ed does not send your names, passwords or task details.
- The API key stays in Cloudflare, not in the website.
- Only your website address (set in `ALLOWED_ORIGIN`) can use the service.

## Limits and troubleshooting

- Answers are checked by Ed's model, not by a person. Ed names its sources; please
  check anything important.
- If Ed says it "could not reach live search", check that the endpoint in `data.js`
  is correct and that `ALLOWED_ORIGIN` matches your website address exactly.
- Opening the site from a file on your computer (`file://`) cannot use live search,
  because the browser does not send a website address. Use your published website.
- To limit spending, set a monthly spending limit in your Anthropic console.
