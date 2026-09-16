import { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import Index from "./pages/index";
import Admin from "./pages/admin";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

const UiOptions = lazy(() => import("./pages/ui-options"));
const PaperStudies = lazy(() => import("./pages/paper-studies"));

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/" component={Index} />
        <Route path="/admin" component={Admin} />
        <Route path="/ui-options">
          <Suspense fallback={<output>Loading welcome studies…</output>}>
            <UiOptions />
          </Suspense>
        </Route>
        <Route path="/paper-studies">
          <Suspense fallback={<output>Loading paper studies…</output>}>
            <PaperStudies />
          </Suspense>
        </Route>
      </Switch>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
