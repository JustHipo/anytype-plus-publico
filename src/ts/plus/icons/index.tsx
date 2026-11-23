// plus: íconos propios de Anytype Plus para los menús, con el mismo trazo que los de menu/action (20×20, 1,5 px).
import React from 'react';
import { registerIcon } from '../../component/util/icons/registry';

// «Aa»: fuente de la página
const PageFont = (props: React.SVGProps<SVGSVGElement>) => (
	<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M2.5 15.5L6.75 4.5L11 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
		<path d="M4.15 11.25H9.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
		<circle cx="14.75" cy="12.5" r="2.75" stroke="currentColor" strokeWidth="1.5"/>
		<path d="M17.5 9.5V15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
	</svg>
);

// Una «T» grande y una chica: tamaño del texto de la página
const PageTextSize = (props: React.SVGProps<SVGSVGElement>) => (
	<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<path d="M2 4.5H11M6.5 4.5V15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
		<path d="M12 9.5H18M15 9.5V15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
	</svg>
);

// Un marco: estilo de bloque (tarjeta)
const BlockFrame = (props: React.SVGProps<SVGSVGElement>) => (
	<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
		<rect x="2.75" y="3.75" width="14.5" height="12.5" rx="3" stroke="currentColor" strokeWidth="1.5"/>
		<path d="M6 8H14M6 11.5H11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
	</svg>
);

registerIcon('aplus/pageFont', PageFont);
registerIcon('aplus/pageTextSize', PageTextSize);
registerIcon('aplus/blockFrame', BlockFrame);
