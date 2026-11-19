# Nova Ops

Nova Ops helps the Nova and Tone Garage teams manage store tasks, deadlines, and employee access.

## Run the app on Windows

You need Node.js 20 or newer. Open the project in VS Code, then open **Terminal → New Terminal** and run:

```powershell
cd C:\Users\manju\Downloads\novamart_ecommerce
npm.cmd install
npm.cmd run dev
```

`npm.cmd install` is only needed the first time. When the terminal says the local server is ready, open **http://127.0.0.1:5173**. Keep the terminal open while using the app; press **Ctrl+C** to stop it.

## Set up the team

- On a new installation, create the first administrator on the sign-in page. Use a password with at least 12 characters. Local setup does not need a Supabase account or setup key.
- Employees can register from the sign-in page. An administrator approves registrations from **Team** before those employees can sign in.
- Administrators create tasks from **Tasks** and assign them to approved employees. Employees see their assigned tasks and can update their status.
- The database is created automatically in the `data` folder. Keep that folder to preserve accounts and tasks.
- The employee/admin preview buttons use temporary sample data; they are not real accounts and do not save changes.

## If you forget the administrator password

From the project folder, run:

```powershell
npm.cmd run reset-admin-password
```

Enter the administrator email and a new password of at least 12 characters when prompted. Password input is hidden. To generate a temporary password instead, run:

```powershell
npm.cmd run reset-admin-password -- --generate --email admin@example.com
```

The generated password is shown once and must be changed after sign-in. Resetting the password signs out that administrator's other sessions.

## Other commands

Build the app:

```powershell
npm.cmd run build
```

For production, configure `NODE_ENV=production`, set a long random `NOVA_SETUP_KEY`, use HTTPS, and keep the database on persistent storage.

## Troubleshooting

- If `npm` is not recognized in PowerShell, use the `npm.cmd` commands above. If Node.js was just installed, restart VS Code.
- If port 5173 or 3001 is already in use, stop the other running app from its terminal with **Ctrl+C**, then run `npm.cmd run dev` again.
