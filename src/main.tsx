import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "next-themes"; // [Tambahkan]

createRoot(document.getElementById("root")!).render(
  // [Bungkus] aplikasi dengan ThemeProvider
  <ThemeProvider defaultTheme="light" attribute="class">
    <App />
  </ThemeProvider>
);