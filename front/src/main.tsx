import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HomePage } from "./pages/HomePage";
import { MatchPage } from "./pages/MatchPage";
import { PvpPage } from "./pages/PvpPage";
import { RunPage } from "./pages/RunPage";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/match" element={<MatchPage />} />
        <Route path="/run" element={<RunPage />} />
        <Route path="/pvp" element={<PvpPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
