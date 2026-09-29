import LanternNav from './LanternNav.jsx';
import ShojiTransition from './ShojiTransition.jsx';
import BrushGate from './BrushGate.jsx';
import SiteFooter from './SiteFooter.jsx';

export default function Shell({ children }) {
  return (
    <>
      <LanternNav />
      <ShojiTransition />
      <BrushGate />
      <main className="app-main">{children}</main>
      <SiteFooter />
    </>
  );
}
