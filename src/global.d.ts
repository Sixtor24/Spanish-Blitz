/// <reference path="./types/auth-create-react.d.ts" />

declare module '*.avif' {
  const src: string;
  export default src;
}
import 'react-router';
module 'virtual:load-fonts.jsx' {
	export function LoadFonts(): null;
}
declare module 'react-router' {
	interface AppLoadContext {
		// add context properties here
	}
}
declare module 'npm:stripe' {
	import Stripe from 'stripe';
	export default Stripe;
}
