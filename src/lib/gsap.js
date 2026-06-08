import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Observer } from "gsap/Observer";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(ScrollTrigger, Observer, Flip);

export { gsap, ScrollTrigger, Observer, Flip };
