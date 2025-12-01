import React from "react";
import ReactDOM from "react-dom/client";
import "./globals.css";
import MovieShowtimeWidget from "./movie-showtime-widget";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <MovieShowtimeWidget />
  </React.StrictMode>,
);
