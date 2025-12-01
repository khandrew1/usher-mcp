import React from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";
import MovieDetailWidget from "./movie-detail-widget";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MovieDetailWidget />
  </React.StrictMode>,
);
