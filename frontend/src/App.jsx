import { useState } from "react";

import FarmDashboard from "./FarmDashboard";
import LandingPage from "./LandingPage";

function App() {
  const [showDashboard, setShowDashboard] = useState(false);

  if (showDashboard) {
    return <FarmDashboard />;
  }

  return <LandingPage onEnterApp={() => setShowDashboard(true)} />;
}

export default App;
