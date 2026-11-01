// motionFeatures.js -- the framer-motion feature bundle LazyMotion loads on
// demand (see main.jsx). Kept in its own module so the dynamic import() is a
// separate chunk. domMax rather than domAnimation: Tabs and SegmentedControl
// slide their active indicator between options with a shared layoutId.
import { domMax } from "framer-motion";

export default domMax;
