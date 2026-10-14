# شاه‌پری

A Persian PWA for iPhone. Plain HTML/JS with no build step. All data stays in the phone's localStorage.

## Deploy (GitHub Pages)
1. Push this folder to a **public** GitHub repo. `vapid-private-key.txt` is gitignored, so it won't be pushed.
2. In the repo, go to Settings → Pages → Deploy from branch → `main` / root.
3. Under Settings → Secrets and variables → Actions → New repository secret, add:
   - `VAPID_PRIVATE_KEY`: the contents of `vapid-private-key.txt`

## On the iPhone (iOS 16.4 or later)
1. Open the Pages URL in Safari. Tap Share → **Add to Home Screen**. Notifications only work in the installed app.
2. In the app, open ⚙️ → **روشن کردن اعلان‌ها**, then **کپی تنظیمات اعلان**.
3. Save the copied text as a repo secret named `SHAHPARI_PUSH`.
4. Test it: Actions → notify → Run workflow. You should get a test notification.

Copy the settings again and update the secret whenever the morning time or pill times change. The ⚙️ icon shows a dot when it's needed.
