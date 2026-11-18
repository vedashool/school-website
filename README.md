# Veda English Medium School Website

Website for **Veda English Medium School**, Kovvada, Andhra Pradesh 533006.
Plain HTML, CSS and JavaScript. No framework, no build step. Photos, categories and
parent enquiries are stored in Supabase (free plan).

## 1. Folder structure

```
index.html            Home (includes the gallery)
about.html            About
academics.html        Academics and Activities
contact.html          Admissions and Contact
admin/                Admin panel (index.html, admin.css, admin.js)
assets/css/           style.css (shared), gallery.css, pages.css
assets/js/            config.js (ALL settings), layout.js, main.js, gallery.js, contact.js
assets/img/           logo.png, favicon.png, hero.jpg, og.jpg, principal.jpg (optional)
supabase/schema.sql   Database setup (run once)
_headers              Security headers, keeps /admin out of Google
robots.txt, sitemap.xml
```

Open `assets/js/config.js` first. Phone, WhatsApp, address, map pin and Supabase keys all live there.

## 2. Supabase setup (about 15 minutes)

Menu names in Supabase change from time to time. If something is not where this says, look nearby.

1. Create a free account at supabase.com and click **New project**. Choose a name, a strong
   database password (save it somewhere safe) and the region closest to your visitors
   (for India, a Mumbai or Singapore region).
2. **Create the admin user.** Go to **Authentication > Users > Add user > Create new user**.
   Enter the school staff email and a strong password, and tick **Auto Confirm User**.
3. **Turn off public sign-ups.** Go to **Authentication > Sign In / Providers** (or
   Configuration) and switch **off** "Allow new users to sign up". This stops strangers
   creating accounts.
4. **Run the database script.**
   - Open `supabase/schema.sql` in a text editor.
   - Find `admin@example.com` and replace it with the admin email from step 2.
   - Go to **SQL Editor > New query**, paste the whole file and click **Run**.
   - You should see "Success". It is safe to run again.
5. **Check storage.** Open **Storage**. A bucket named `gallery` should exist and be marked Public.
6. **Copy your keys.** Go to **Project Settings > API** (or API Keys). Copy:
   - the **Project URL**, and
   - the public key (called **anon** or **publishable**).

   Paste them into `assets/js/config.js` as `supabaseUrl` and `supabaseAnonKey`.
   **Never** paste the `service_role` or secret key into the website. It would give
   everyone full access to your database.
7. **Test:** open the site, go to `/admin`, sign in, add a category and a photo, then check the Home gallery.

### What the database rules allow

| Who | Can do |
|---|---|
| Public visitors | Read categories and photos. Send an enquiry. Nothing else. |
| The admin (the one email in `is_admin`) | Add, change and delete photos and categories. Upload and delete image files. Read enquiries. |

Even if someone finds `/admin`, they cannot change anything without the admin login,
because these rules are enforced by the database, not by the web page.

Enquiries are also limited by the database: at most 3 per phone number per hour and 40 in total per hour.

### Free plan notes

- Supabase's free plan can pause a project that has had no activity for a while (about a week at the time of writing,
  but check Supabase's current rules). Real visitors loading the gallery count as activity. If the site is ever quiet
  for a long time and the gallery stops loading, open the project in the Supabase dashboard and click **Restore**.
- The gallery shows up to the newest 1000 photos.
- Each photo is limited to 5 MB in storage (the admin panel shrinks photos to far below this).
- To back up enquiries, open **Table Editor > enquiries** and export as CSV now and then.

## 3. Test locally

Use VS Code with the **Live Server** extension (right-click `index.html` > Open with Live Server).
Opening the files by double-clicking can break some features.

To see the intro animation again, open the site in a new tab (it shows once per browser session).
To see which text still needs client confirmation, add `?review` to a page address, for example `about.html?review`.

## 4. Deploy (GitHub + Cloudflare Pages, free)

Do not use Vercel's free Hobby plan for client work, because it does not allow commercial use.

1. Create a GitHub repository and upload the whole folder (the `index.html` file must be at the top level of the repository).
2. Cloudflare dashboard > **Workers and Pages > Create > Pages > Connect to Git**, choose the repository.
3. Settings: **Framework preset: None. Build command: leave empty. Build output directory: `/`** (or leave blank). Click **Save and Deploy**.
4. Every time you push to GitHub, the site updates automatically.

**Netlify instead:** Add new site > Import from Git > choose the repository. Leave the build command empty and set the publish directory to `.`

Both services serve `about.html` as `/about`, which matches the canonical links used in the pages.

## 5. Connect vedaschool.online

**Cloudflare Pages:**
1. In your Pages project open **Custom domains > Set up a domain** and enter `vedaschool.online`. Repeat for `www.vedaschool.online`.
2. The easiest route is to add the domain to Cloudflare (free) and change the nameservers at the domain registrar to the two Cloudflare gives you. Cloudflare then creates the DNS records for you.
3. If you keep DNS at the registrar instead, add the records Cloudflare shows. The root (`vedaschool.online`) usually needs an ALIAS/ANAME or CNAME-flattening record, which not every registrar offers; if yours does not, use the nameserver route.
4. HTTPS is automatic and can take a few minutes up to a few hours.
5. Pick one main address (with or without `www`) and redirect the other to it.

**Netlify:** Site settings > Domain management > Add a domain, then use the DNS records Netlify shows.

If the final domain is different from `vedaschool.online`, search for it in the HTML files, `robots.txt` and `sitemap.xml` and replace it.

## 6. How the school staff use the admin panel

Address: **vedaschool.online/admin** (bookmark it; it is not linked anywhere on the public site).

1. Type the email and password and tap **Sign in**.
2. Choose what to do:
   - **Add photos:** choose a category (or create a new one), tap *Choose photos*, select as many photos as you like, then tap *Upload photos*. Wait for every photo to show "Uploaded".
   - **Delete photos:** find the photo, tap *Delete*, then confirm.
   - **Manage categories:** create, rename or delete. A category that still has photos cannot be deleted. Delete its photos first.
   - **View enquiries:** parents' messages, newest first. Tap a phone number to call.
3. Tap **Sign out** when finished, especially on a shared computer.

Tips for staff:
- Use JPG, PNG or WebP photos. Up to 15 MB each, and up to 30 at a time.
- A category only appears on the website once it has at least one photo.
- New photos appear first in the gallery.

**Forgot the password?** In Supabase open **Authentication > Users**, delete the admin user and create it again
with the same email and a new password (Add user > Create new user, tick Auto Confirm). Photos and enquiries are not affected.

## 7. Placeholders that need client confirmation

Open any page with `?review` at the end to see these outlined in orange.

| Where | What is needed |
|---|---|
| `assets/js/config.js` | WhatsApp number (with country code, digits only), phone, email (optional), full street address, days open, map latitude and longitude, Supabase URL and key |
| `assets/css/style.css` (`:root`) | Two colours picked to match the logo: `--primary` and `--accent`. Currently my own guess (deep blue and gold) because the logo was not visible when building |
| `assets/img/` | `logo.png`, `favicon.png` (square), `hero.jpg` (about 1200x1000), `og.jpg` (1200x630). `principal.jpg` is optional |
| `index.html` | Hero tagline (the client's Promise line is used, since no separate tagline was given). The welcome paragraph and the "Enquire About Admission" wording were written from the supplied facts only |
| `about.html` | Principal's Message text, name and photo (generic placeholder now). Faculty section is left out until teacher details are provided |
| `academics.html` | Board or syllabus, Facilities, Student Activities (generic copy built only from the Special Qualities list) |
| `contact.html` | The three admission steps (generic) |
| `index.html` and `contact.html` | The School structured data (JSON-LD) should get the telephone, full address and map coordinates once known |
| Google Maps | The public Maps listing shows the name "Veda Concept School". The site uses exact coordinates, so it is not affected, but the school may want to correct its listing |

## 8. Security notes

- Only the public anon/publishable key is in the website code. No secret key anywhere.
- Sign-ups are disabled and the database only trusts one admin email.
- `/admin` has `noindex`, so search engines skip it. It is not linked from the public pages.
- The enquiry form has a hidden spam trap, a minimum fill time, a per-browser limit and database-level limits.

## 9. Handing over to the client

Move or share ownership of these accounts with the school (or agree who keeps them):
the Supabase project, the GitHub repository, the Cloudflare (or Netlify) project, and the domain registrar.
Give the staff the admin email, the password and the `/admin` address, and the section 6 instructions.

## 10. Troubleshooting

| Problem | Likely cause |
|---|---|
| Gallery says "Photos will be added soon" | Supabase keys are not in `config.js`, or no photos have been uploaded yet |
| Gallery says "Photos could not be loaded" | Wrong URL or key, SQL not run, or the Supabase project is paused |
| Sign in says email or password is not correct | The user was not created, or "Auto Confirm User" was not ticked |
| Upload fails with "not allowed" | The email in `is_admin()` does not match the admin's email. Edit it in the SQL and run the script again |
| Enquiry form says it cannot send | Keys missing, SQL not run, or the rate limit was reached |
| Map shows a message instead of a map | `mapLat` and `mapLng` are still empty in `config.js` |