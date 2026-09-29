import Navbar from './Navbar.jsx';
import SiteFooter from './SiteFooter.jsx';
import InkTrail from './InkTrail.jsx';
import InkTransition from './InkTransition.jsx';

export default function Shell({ children }) {
  return (
    <>
      <InkTrail />
      <InkTransition />
      <Navbar />
      <main className="app-main">{children}</main>
      <SiteFooter />
    </>
  );
}
