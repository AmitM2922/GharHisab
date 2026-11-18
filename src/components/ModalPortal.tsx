import {createPortal} from 'react-dom';
import type {ReactNode} from 'react';

// Fixed dialogs must live outside animated/transformed dashboard containers.
// Portals preserve React context while escaping ancestor stacking contexts.
export default function ModalPortal({children}:{children:ReactNode}){
 return createPortal(children,document.body);
}
