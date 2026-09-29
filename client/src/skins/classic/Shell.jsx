import Navbar from './Navbar.jsx';

export default function Shell({ children }) {
  return (
    <>
      <Navbar />
      <main className="app-main">{children}</main>

    </>
  );
}
