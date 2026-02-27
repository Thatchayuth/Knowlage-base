import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import bookIcon from './img/book.png'

const favicon = document.querySelector("link[rel='icon']")
if (favicon) favicon.href = bookIcon

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
