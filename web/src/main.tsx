import { render } from "preact";
import { App } from "./app/App";
import "./styles/globals.css";

const root = document.getElementById("app");
if (root) render(<App />, root);
