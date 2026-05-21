import React from 'react'
import ReactDOM from 'react-dom/client'
import { library } from '@fortawesome/fontawesome-svg-core'
import { fas } from '@fortawesome/free-solid-svg-icons'
import { far } from '@fortawesome/free-regular-svg-icons'
import { fab } from '@fortawesome/free-brands-svg-icons'
import App from './App.jsx'
import './index.css'
import bookIcon from './img/book.png'

library.add(fas, far, fab)

const favicon = document.querySelector("link[rel='icon']")
if (favicon) favicon.href = bookIcon

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
