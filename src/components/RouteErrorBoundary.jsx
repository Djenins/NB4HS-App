// RouteErrorBoundary.jsx -- wraps the page area in Shell. Without it, any
// error while loading or drawing a page unmounted the whole app and left a
// blank white screen. Now:
//  * a page whose code file is gone after a deploy reloads once to pick up
//    the new version (lib/chunkReload.js);
//  * anything else shows a short message with a Reload button, plus the
//    error text so staff can tell us what broke.
// Shell keys it by path, so moving to another page clears the error.
import { Component } from "react";
import { RotateCw, TriangleAlert } from "lucide-react";
import { useT } from "../context/AppContext.jsx";
import { isChunkLoadError, reloadOnceForNewDeploy } from "../lib/chunkReload.js";
import { Button } from "./ui/button.jsx";

function ErrorScreen({ error }) {
  const t = useT();
  return (
    <div role="alert" className="mx-auto my-10 flex max-w-[560px] flex-col items-center gap-3 rounded-surface border border-border bg-card px-6 py-8 text-center shadow-card">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-tone-warning-bg text-tone-warning-ink">
        <TriangleAlert className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="m-0 text-heading font-bold text-card-foreground">{t("routeErrorTitle")}</h1>
      <p className="m-0 text-body text-muted">{t("routeErrorDesc")}</p>
      <Button onClick={() => window.location.reload()}><RotateCw className="h-4 w-4" aria-hidden="true" />{t("routeErrorReload")}</Button>
      {error && error.message ? (
        <p className="m-0 mt-2 max-w-full break-words font-mono text-meta text-muted">{error.message}</p>
      ) : null}
    </div>
  );
}

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Page failed to load or render", error, info && info.componentStack);
    if (isChunkLoadError(error)) reloadOnceForNewDeploy();
  }
  render() {
    if (this.state.error) return <ErrorScreen error={this.state.error} />;
    return this.props.children;
  }
}
