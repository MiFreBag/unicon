// client/src/ui/Icon.jsx
import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlus,
  faCircleQuestion,
  faMagnifyingGlass,
  faArrowsRotate,
  faPaperPlane,
  faEye,
  faEyeSlash,
  faCopy,
  faTrashCan,
  faPlay,
  faSquare,
  faGear,
  faDatabase,
  faGlobe,
  faServer,
  faBolt,
  faMessage,
  faLayerGroup,
  faList
} from '@fortawesome/free-solid-svg-icons';

const map = {
  'plus': faPlus,
  'circle-question': faCircleQuestion,
  'magnifying-glass': faMagnifyingGlass,
  'arrows-rotate': faArrowsRotate,
  'paper-plane': faPaperPlane,
  'eye': faEye,
  'eye-slash': faEyeSlash,
  'copy': faCopy,
  'trash-can': faTrashCan,
  'play': faPlay,
  'square': faSquare,
  'gear': faGear,
  'database': faDatabase,
  'globe': faGlobe,
  'server': faServer,
  'bolt': faBolt,
  'message-square': faMessage,
  'layers': faLayerGroup,
  'list': faList,
};

export default function Icon({ name, size = 16, className = '' }) {
  const icon = map[name] || faCircleQuestion;
  // Use style fontSize to mimic pixel sizing
  return <FontAwesomeIcon icon={icon} className={className} style={{ fontSize: `${size}px` }} />;
}
