'use strict';

import { h, render, Component } from 'preact';
//import Router from 'preact-router';
//import { route } from 'preact-router';
//import Main from './Main.js';
const SpinePaginator = require('../spine_paginator.js');
import Loading from './Loading.js';
import OPF from '../opf.js';
import {parseDOM, parseXML, parseXHTML} from '../parse_dom.js';

export default class Root extends Component {

  constructor(props) {
    super();
    
    this.state = {
      status: '',
      uri: '',
      baseuri: props.baseuri
    }

    // tracks which keys are currently pressed
    this.keysDown = {};
    
    this.onkeydownBound = this.onkeydown.bind(this);
    this.onkeyupBound = this.onkeyup.bind(this);
  }
  
  absoluteURI(relativeURI) {
    return this.state.baseuri + '//' + relativeURI;
  }

  async readOPF(filepath, path, cb) {
    return new Promise((resolve, reject) => {
      Fread.getFromZip(filepath, path, false, function(err, str) {
        if(err) return reject(err);
        
        try {
          var opf = new OPF(str);
        } catch(err) {
          return reject(err);
        }
        
        resolve(opf);    
      });
    });
  }

  // Returns the path to the Package Document (.opf file)
  // for the first representation found in `META-INF/container.xml`
  async readContainerXML(filepath, cb) {
    return new Promise((resolve, reject) => {
      Fread.getFromZip(filepath, 'META-INF/container.xml', false, function(err, str) {
        if(err) return reject(err);

        try {
          var doc = parseXML(str);
        } catch(err) {
          return reject(err);
        }

        var els = doc.querySelectorAll("container > rootfiles > rootfile");
        console.log("rootfiles:", els);
        
        if(els.length < 1) {
          return reject(new Error("This work appears to have no representations listed in its META-INF/container.xml file"));
        }
        if(els.length > 1) {
          // TODO handle multiple representations
          console.log("Note: This epub has more than one representation but we're only showing the first (default) representation. This is allowed by the epub 3.0.1 standard but we should do better.");
        }

        var el = els[0];
        var opfPath = el.getAttribute('full-path');
        if(!opfPath) {
          return reject(new Error("Failed to find the Package Document (.opf) file path"));
        }

        if(opfPath[0] === '/') {
          opfPath = opfPath.slice(1);
        }

        resolve(opfPath);
        
      });
    });
  }


  
  async parseEpub(cb) {

    var filepath = Fread.uriToPath(window.location.href);
    
    const opfPath = await this.readContainerXML(filepath);
      
    return await this.readOPF(filepath, opfPath);
  }

  onkeydown(e) {

    switch(e.keyCode) {
      
    case 32: // space
    case 39: // right arrow

      if(this.keysDown[e.keyCode]) break;
      this.keysDown[e.keyCode] = true;
      this.paginator.nextPage();
      break;
    case 37: // left arrow
      if(this.keysDown[e.keyCode]) break;
      this.keysDown[e.keyCode] = true;
      this.paginator.prevPage();
      break;
    }
    
  }

  onkeyup(e) {
    switch(e.keyCode) {
      
    case 32: // space
    case 39: // right arrow
    case 37: // left arrow
      
      if(!this.keysDown[e.keyCode]) break;
      delete this.keysDown[e.keyCode]
    }

  }
  
  async componentDidMount() {
    try {
      var opf = await this.parseEpub();
    } catch(err) {
      console.error(err);
      return;
    }

    var curURI;
    
    if(opf.coverPage) {
      curURI = opf.coverPage
    } else {
      curURI = opf.spine.items[0]
    }
      
    this.setState({
      uri: curURI
    });
    
    const pageElementID = "page";


    this.paginator = new SpinePaginator(pageElementID, opf.spine.items, {
      columnLayout: false,
      repeatTableHeader: false,
      cacheForwardPagination: false,
      loadScripts: false,
      detectEncoding: true,
      preprocessCSS: true,
      baseURI: document.baseURI + '//'
    });
    
    await this.paginator.load(curURI);
    
    document.addEventListener('keydown', this.onkeydownBound);
    document.addEventListener('keyup', this.onkeyupBound)

  }

  componentWillUnmount() {
    document.removeEventListener('keydown', this.onkeydownBound);
    document.removeEventListener('keyup', this.onkeyupBound);
  }

    
  render(props, state) {

    if(this.state.status == 'LOADING') {
      return (
        <Loading />
      );
    }
    
    return (
      <div id="page"></div>
    );

  }
}


