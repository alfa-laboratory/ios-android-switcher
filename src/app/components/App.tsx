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
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState([]);

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
        setError(message.error);
        setNotFound(message.notFound);
      }
    };
  }, []);

  const handleSwitchButtonClick = useCallback(() => {
    postMessage({ type: 'SWITCH', data });
    setError(null);
    setNotFound([]);
    setPending(true);
  }, [data]);

  return (
    <div className="plugin">
      <Button onClick={handleSwitchButtonClick} disabled={!loaded || pending}>
        switch
      </Button>

      {error && <span className="error">{error}</span>}

      {notFound.length > 0 && (
        <div className="not-found">
          Не найдены пары
          {notFound.map((name) => (
            <span key={name}>{name}</span>
          ))}
        </div>
      )}
    </div>
  );
};

export default App;
