import Navbar from './Navbar.jsx';
import SiteFooter from './SiteFooter.jsx';
import NeonRain from './NeonRain.jsx';
import CursorLight from './CursorLight.jsx';

export default function Shell({ children }) {
  return (
    <>
      <NeonRain />
      <CursorLight />
      <Navbar />
      <main className="app-main">{children}</main>
      <SiteFooter />
    </>
  );
}
