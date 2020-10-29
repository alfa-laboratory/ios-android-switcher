import React, { useCallback, useState, useEffect } from 'react';
import axios from 'axios';
import Button from './Button';

import '../styles/app.css';

const REPO_URL = 'https://raw.githubusercontent.com/alfa-laboratory/figma-mobile-components/master';
const PAIRS_URL = `${REPO_URL}/data/pairs.json`;
const COMPONENTS_URL = `${REPO_URL}/data/components.json`;

const postMessage = (payload: { type: MessageType; [key: string]: any }) => {
  parent.postMessage({ pluginMessage: payload }, '*');
};

const App = ({}) => {
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [data, setData] = useState(null);
  const [results, setResults] = useState([]);

  useEffect(() => {
    axios.all([axios.get(PAIRS_URL), axios.get(COMPONENTS_URL)]).then(
      axios.spread((pairsResponse, componentsResponse) => {
        const components = componentsResponse.data;
        const pairs = Object.keys(pairsResponse.data).reduce((acc, key) => {
          acc[pairsResponse.data[key]] = key;
          return acc;
        }, pairsResponse.data);

        setLoaded(true);

        setData({
          pairs,
          components,
        });
      })
    );

    window.onmessage = (event: MessageEvent) => {
      console.log(event.data.pluginMessage);

      const { type, message } = event.data.pluginMessage as { type: MessageType; message: any };

      if (type === 'DONE') {
        setPending(false);
        setResults(message);
      }
    };
  }, []);

  const handleSwitchButtonClick = useCallback(() => {
    setResults([]);
    setPending(true);
    setTimeout(() => {
      postMessage({ type: 'SWITCH', data });
    }, 100);
  }, [data]);

  const handleRestoreButtonClick = useCallback(() => {
    postMessage({ type: 'RESTORE' });
  }, []);

  const handleFocus = (nodeId: ComponentNode) => {
    postMessage({ type: 'FOCUS', nodeId });
  };

  const renderResults = useCallback(() => {
    const fails = results.filter((r) => r.result !== 'SUCCESS');
    const success = results.filter((r) => r.result === 'SUCCESS');

    return (
      <div className="results">
        <span className="section-title">Ошибки - {fails.length}</span>
        {fails.map((item, i) => (
          <a key={i} onClick={() => handleFocus(item.id)}>
            {item.name} — {item.result}
          </a>
        ))}

        <span className="section-title">Заменено - {success.length}</span>
        {success.map((item, i) => (
          <a key={i} onClick={() => handleFocus(item.id)}>
            {item.name}
          </a>
        ))}
      </div>
    );
  }, [results]);
  return (
    <div className="plugin">
      <h1>UI/UX от бога 🙈</h1>

      <p>Выдели фрейм, который хочешь поменять</p>

      <Button onClick={handleSwitchButtonClick} disabled={!loaded || pending}>
        Заменить на парный
      </Button>

      <p>
        Выдели сначала новый КОМПОНЕНТ (не фрейм), потом нажми command+shift и выдели старый компонент. Если звезды
        сойдутся, то изменения применятся на замененный компонент.
      </p>

      <Button onClick={handleRestoreButtonClick} disabled={!loaded || pending}>
        Попробовать накатить изменения
      </Button>

      <p>
        Если что-то не работает, открой консоль (Plugins {'->'} Development {'->'} Open Console), запусти плагин еще раз
        и <a href="https://t.me/reme3d2y">скинь скриншот</a>
      </p>

      {results.length > 0 && renderResults()}
    </div>
  );
};

export default App;
