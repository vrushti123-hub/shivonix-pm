Fresh deploy checklist

1. Deploy backend from `shivonix-server-main` on Render.
   - Build command: `npm install`
   - Start command: `npm start`
   - Keep env vars: `DATABASE_URL`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`, `FRONTEND_URL`.

2. Deploy frontend from this folder's `index.html` on Netlify.
   - Replace the old deployed `index.html` completely.
   - Hard refresh after deploy.
   - If the host has cache settings, purge cache/CDN.

3. Set `FRONTEND_URL` in Render/backend to the exact frontend URL.
   - Invite emails use this for the accept link.
   - If this points to an old frontend deployment, invitees will keep seeing old UI.

4. Quick smoke test.
   - Login as owner.
   - Create a Team Board.
   - Invite another email.
   - Open accept link in incognito or a different browser.
   - Confirm the sidebar shows `My Board` and `Team Board`, not the old `Switch Board` dropdown.
