import { useEffect, useState } from "react";

import FarmDashboard from "./FarmDashboard";
import LandingPage from "./LandingPage";

function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const updatePath = () => setPath(window.location.pathname);
    window.addEventListener("popstate", updatePath);
    return () => window.removeEventListener("popstate", updatePath);
  }, []);

  const navigate = (to, { replace = false } = {}) => {
    if (window.location.pathname !== to) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", to);
      setPath(to);
    }
  };

  if (path === "/dashboard" || path.startsWith("/dashboard/")) {
    return <FarmDashboard routePath={path} onRouteChange={navigate} />;
  }

  return <LandingPage onEnterApp={() => navigate("/dashboard")} />;
}

export default App;
