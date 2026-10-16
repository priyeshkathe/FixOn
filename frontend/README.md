# UniFix frontend

This folder contains the React and Vite frontend for UniFix.

## Run the frontend only

From the repository root, run:

```sh
npm run dev
```

Then open the local URL printed by Vite (usually `http://localhost:5173`). This starts only the frontend; it does not start the backend or Electron app.

To create a production build of the frontend, run `npm run build` from the repository root.

Pages can be reviewed without a backend. Features that use authentication, live system data, or remote API services require those services to be available.
