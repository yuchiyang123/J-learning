// One skin = its full stylesheet plus the shell around the routes and its
// home page. Loaded as a single lazy chunk (see skins/registry.js), so a
// visitor only ever downloads the skin they're actually using.
import css from './styles.css?inline';
import Shell from './Shell.jsx';
import Home from './Home.jsx';

export default { css, Shell, Home };
