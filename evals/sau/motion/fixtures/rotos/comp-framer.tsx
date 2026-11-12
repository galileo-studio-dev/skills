import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** ROTO: depende de framer-motion. */
export function Roto({ children }: { children: ReactNode }) {
  return <motion.div initial={{ opacity: 0 }}>{children}</motion.div>;
}
