# HR Manager & Salary Analytics

## Project layout

- `backend/`: Express API connected to the instructor-provided MySQL database.
- `frontend/`: Expo / React Native application.

The API uses the instructor-provided `ip_std6730202602.employees` table. Its physical column names use the student's name prefix (`CharuesaSuksahwang_...`), while the API returns the regular employee fields `id`, `name`, `position`, `status`, and `salary` to the app. Other tables are untouched.

Before deploying this backend version, back up the `employees` table and run `backend/rename_employee_columns.sql` once in phpMyAdmin with `ip_std6730202602` selected. This renames the existing columns without replacing employee rows. Stop the running API, apply the SQL, upload the updated `server.js`, then restart the API. Do not run the rename SQL a second time.

## Configure and start the API

In `backend/`, copy `.env.example` to `.env`, then fill in the MySQL host, username, and password supplied by the TA/instructor. Do not share the database password in chat or commit `.env` to GitHub.

```sh
cd backend
npm install
npm start
```

If the MySQL host blocks remote connections, the API must run on the server/network where MySQL is available, or the TA must enable the proper access. phpMyAdmin being reachable does not by itself mean MySQL accepts connections from your computer.

## Start the app

Set `EXPO_PUBLIC_API_URL` to the computer running the Express API (for example, `http://localhost:3000` on the same computer, or `http://COMPUTER_LAN_IP:3000` on a phone over the same Wi-Fi), then:

```sh
cd frontend
npm install
npx expo start
```

Login defaults are `admin` / `password123` unless changed in backend `.env`. Employee endpoints require the bearer token returned by login. With `SEED_MOCK_DATA=true`, the API inserts the five assignment mock records only when the employees table is empty; existing rows are never overwritten.

Required GitHub repository name: `Std0202602IPFinal2026` (the last 7 digits of student ID `6730202602` are `0202602`).

