import Navbar from './Navbar.jsx';
import SiteFooter from './SiteFooter.jsx';
import SakuraPetals from './SakuraPetals.jsx';
import InkRipple from './InkRipple.jsx';

export default function Shell({ children }) {
  return (
    <>
      <SakuraPetals />
      <InkRipple />
      <Navbar />
      <main className="app-main">{children}</main>
      <SiteFooter />
    </>
  );
}
