/**
 *     _____                            __ _____
 *    | __  |___ ___ _ _ _____ ___   __|  |   __|
 *    |    -| -_|_ -| | |     | -_|_|  |  |__   |
 *    |__|__|___|___|___|_|_|_|___|_|_____|_____|
 *
 * a little JS code for displaying a dynamic resume based on
 *  - an array of structured YAML data ({@link YamlResumeItem})
 *  - A theme specified via CSS vars in style.css, which of course can be updated outside of css vars
 *  - An organization of data as specified in index.html,
 *    hydrated with appropriate data with ({@link displayResume})
 *
 * Should be easyish to hack on! Just change
 *  - style.css to match your stylistic preferences,
 *  - index.html to match your resume layout preferences
 *  - resume.yaml to be your resume info
 * ... and theoretically no need to change resume.js, but I suppose you could
 *
 * @license
 * Copyright (c) 2024 Nolan Hawkins.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * @typedef {string | [string, number]} YamlTag
 * specification tagging a company, project, etc with a technology or idea or skill
 */
/**
 * @typedef {Object} YamlFullDescription
 * @property {string} text
 * @property {?Array.<YamlTag>} tags Different descriptions may be shown depending on the
 * tags specified, e.g. you may want to display one description for front-end and another for back-end
 * @property {?number} importance
 */
/**
 * @typedef {string | YamlFullDescription} YamlDesc Descriptive text of a job, project, etc
 */
/**
 * @typedef {Object} ResumeItemMeta Every item in the resume can be annotated
 * by a list of tags and a list of descriptions
 * @property {Array.<YamlTag>} tags
 * @property {Array.<YamlDesc>} descs One description of the job will be shown depending on current tags
 * @property {?Array.<Tag>} parsedTags
 * @property {?Array.<Desc>} parsedDescs
 */
/**
 * @typedef {Object} YamlJob Specification of a particular job
 * @property {!string} company Name of the company
 * @property {!string} title Job title worked at the company
 * @property {!string} time Time period worked at the company
 *  (just a string, the actual dates are not used as rich data anywhere)
 * @property {?string} alias Shortened form of the company name that you can use as a reference, not displayed
 * @property {Array.<YamlTag>} tags
 * @property {Array.<YamlDesc>} descs
 */
/**
 * @typedef {Object} YamlCompanyProject Specification of something worked at at a job
 * @property {string} companyProject name of company or company alias that this project occurred at
 * @property {Array.<YamlTag>} tags
 * @property {Array.<YamlDesc>} descs
 */
/**
 * @typedef {Object} YamlPersonalProject
 * @property {string} title name of the project
 * @property {?string} src URL to project
 * @property {Array.<YamlTag>} tags
 * @property {Array.<YamlDesc>} descs
 */
/**
 * @typedef {Object} YamlEducation
 * @property {string} education title of education to display
 * @property {string} location
 * @property {string} degree
 * @property {Array.<string>} majors
 * @property {Array.<string>} minors
 * @property {string} gPA
 * @property {Array.<string>} accolades
 * @property {Array.<YamlTag>} tags
 * @property {Array.<YamlDesc>} descs
 */

/**
 * @typedef {Object} YamlResumeMeta
 * @property {Object} meta
 */
/**
 * @typedef {YamlResumeMeta      |
 *           YamlJob             |
 *           YamlCompanyProject  |
 *           YamlPersonalProject |
 *           YamlEducation
 * } YamlResumeItem
 */

/**
 * @typedef {Object} DisplayContext
 * @property {Array.<string>} tags
 * @property {?string} search
 */

/**
 * @typedef {Object.<string, Array.<ContextInfo> |  Object.<string, ContextInfo> | string | number |  null>} ContextInfo
 * ContextInfo is a recursive structure that can kind of effectively be anything
 * used for hydrating specific data values in index.html
 */

/**
 * Tags and Descs allow you to specify an "importance" which is dynamically used
 * to determine what to show and what not to show ({@link findBestDescription})
 * Tags with an importance below the MINIMUM will not be shown unless they are relevant to the DisplayContext
 * Tags without a specified importance will be granted the DEFAULT
 */
const DEFAULT_IMPORTANCE = 50;
const MINIMUM_IMPORTANCE = 30;
/** Contexts in the recursive Info object that are always shown */
const ALWAYS_SHOWN_DATA = new Set(["meta", "sortedTags"]);

/**
 * Global object, parsed from resume.yaml, that will contain all resume information
 * @name info
 * @type {ContextInfo}
 */
const info = {
  /** @type {Object.<string, YamlJob>} */
  companies: {},
  /** @type {Array.<YamlPersonalProject>} */
  personalProjects: [],
  /** @type {Array.<YamlEducation} */
  educations: [],
  /** @type {Object.<string, Tag>} */
  tags: {},
  /** @type {Array.<string>} */
  sortedTags: [],
  /** @type {Object} */
  meta: {},
};

/**
 * Sort array of objects in place by an array of fields defined on that object. Values are compared with > and <
 * @param {Array.<Object.<K, V>>} array array of objects which should all have values for all the fields
 * @param {Array.<K>} fields List of fields to sort by, with the first field being the primary sort, etc
 * @returns array now sorted in place
 */
function sortByFields(array, fields) {
  return array.sort(function (a1, a2) {
    for (field of fields) {
      if (a1[field] < a2[field]) return 1;
      if (a1[field] > a2[field]) return -1;
    }
    return 0;
  });
}

/**
 * Basically a very light and unexamined markdown formatter
 * adding _italic_, *bold*, and `preformatted` text
 * probably a million edge cases that don't work, but just don't do those!
 * @param {string} text
 * @returns String with embedded HTML elements
 */
function prettyFormat(text) {
  return text
    .replace(/_(.+)_/g, "<i>$1</i>")
    .replace(/\*(.+)\*/g, "<b>$1</b>")
    .replace(/`(.+)`/g, "<code>$1</code>");
}

/**
 * @typedef {Object} ObjectTag Encoded relationship between an object and a tag
 * @property {string} id Lower case string representation of tag
 * @property {number} importance importance rating
 */
/**
 * @typedef {Object} Tag
 * @property {string} title  Display string for the tag
 * @property {string} id  Lower case string representation of tag
 * @property {Array.<string>} aliases list of aliases
 * @property {number} uses Count of different jobs, companies, projects that have this tag
 */

/**
 * Add tag and an optional list of aliases to info, if tag is not already in the info
 * Tags are treated equivalently if and only if they match ignoring case
 * @param {string} tag bit of text to store in the tag array
 * @param {?Array.<string>} aliases optional list of aliases
 * @returns {Tag} List of tags in the info object
 */
function addTag(tag, aliases) {
  const lTag = tag.toLowerCase();
  const uses = lTag in info.tags ? info.tags[lTag].uses + 1 : 1;
  if (aliases || !(lTag in info.tags)) {
    info.tags[lTag] = {
      title: tag,
      id: lTag,
      aliases: aliases,
      uses: uses,
    };
  }
  return info.tags[lTag];
}

/**
 * Parse tags from Yaml and return the list of parsed data
 * @param {Array.<YamlTag>} tags
 * @returns {Array.<ObjectTag>} list of tags
 */
function parseTags(tags) {
  /** @type {Array.<ObjectTag>} */
  const parsedTags = [];
  for (const tag of tags) {
    let importance = DEFAULT_IMPORTANCE;
    let tagText;
    if (typeof tag == "string") {
      tagText = tag;
    } else {
      tagText = tag[0];
      importance = tag[1];
    }
    const canonicalTag = addTag(tagText, []);

    parsedTags.push({
      id: canonicalTag.id,
      importance: importance,
    });
  }
  return parsedTags;
}

/**
 * @typedef {Object} Desc Parsed description information
 * @property {string} text
 * @property {Array.<ObjectTag>} parsedTags
 * @property {number} importance
 * @property {number} length character length of the descriptive text
 */
/**
 * Parse yaml descriptions into Desc objects
 * @param {?Array.<YamlDesc>} descs
 * @returns {Array.<Desc>} List of parsed descriptions sorted by importance
 */
function parseDescs(descs) {
  if (!descs) {
    return [];
  }
  /** @type {Array.<Desc>} */
  const parsedDescs = [];
  for (const desc of descs) {
    let tags = [];
    let importance = DEFAULT_IMPORTANCE;
    let text = "";
    if (typeof desc !== "string") {
      text = desc.text;
      if ("tags" in desc) {
        tags = parseTags(desc.tags);
      }
      if ("importance" in desc) {
        importance = desc.importance;
      }
    } else {
      text = desc;
    }
    text = prettyFormat(text);
    parsedDescs.push({
      text: text,
      parsedTags: tags,
      importance: importance,
      length: text.length,
    });
  }

  parsedDescs.sort(function (d1, d2) {
    return d1.importance - d2.importance;
  });

  return parsedDescs;
}

/**
 * Adds parsed tags and descriptions to a resume item
 * @param {ResumeItemMeta} obj
 */
function addTagsAndDescs(obj) {
  obj.parsedTags = parseTags(obj.tags);
  obj.parsedDescs = parseDescs(obj.descs);
}

/**
 * Adds Yaml job object to info
 * @param {YamlJob} job
 */
function parseJob(job) {
  addTagsAndDescs(job);
  job.projects = [];
  if ("alias" in job) {
    info.companies[job.alias] = job;
  } else {
    info.companies[job.company] = job;
  }
}

/**
 * Adds Yaml Company project to info
 * @param {YamlCompanyProject} proj
 */
function parseCompanyProject(proj) {
  if (!proj.companyProject in info.companies) {
    console.warn(
      `Expected to find a job by the name of ${proj.companyProject}`
    );
    return;
  }
  addTagsAndDescs(proj);
  info.companies[proj.companyProject].projects.push(proj);
}
/**
 * Adds Yaml personal project to info
 * @param {YamlPersonalProject} proj
 */
function parsePersonalProject(proj) {
  addTagsAndDescs(proj);
  info.personalProjects.push(proj);
}

/**
 * Add Yaml Education
 * @param {YamlEducation} edu
 */
function parseEducation(edu) {
  info.educations.push(edu);
}
/**
 * Add Yaml tag, for giving additional information about a tag
 * @param {*} tag
 */
function parseTag(tag) {
  addTag(tag.tag, tag.aliases);
}

/**
 * If field is defined within obj, returns the link to the field as a HTML string
 * e.g. bar.com      -> <a href="http://bar.com" target="_blank">bar.com</a>
 * and  foo@bar.com  -> <a href="mailto:foo@bar.com" target="_blank">foo@bar.com</a>
 * @param {Object} obj Object to modify
 * @param {string} field
 * @returns {string} <a> href tag
 */
function linkifyField(obj, field) {
  if (field in obj) {
    const url = obj[field];
    const href = url.indexOf("@") != -1 ? "mailto:" + url : "https://" + url;

    return `<a href="${href}" target="_blank">${url}</a>`;
  } else {
    console.warn(`${field} not in ${obj}`);
    return "";
  }
}

/**
 * Add Yaml Metadata
 * @param {YamlResumeMeta} meta
 */
function parseMeta(meta) {
  meta.parsedDescs = parseDescs(meta.descs);
  info.meta = [meta];
}

/**
 * Parse a Yaml Resume Item, populating the info object
 * @param {YamlResumeItem} obj
 */
function parseResumeItem(obj) {
  if ("company" in obj) {
    parseJob(obj);
  } else if ("companyProject" in obj) {
    parseCompanyProject(obj);
  } else if ("personalProject" in obj) {
    parsePersonalProject(obj);
  } else if ("education" in obj) {
    parseEducation(obj);
  } else if ("tag" in obj) {
    parseTag(obj);
  } else if ("meta" in obj) {
    parseMeta(obj.meta);
  } else {
    console.warn(`Could not parse resume, ${obj} is invalid`);
  }
}

/**
 * Parse the full resume yaml
 * @param {Array.<YamlResumeItem>} resumeObjects
 */
function parseResume(resumeObjects) {
  for (const resumeObject of resumeObjects) {
    parseResumeItem(resumeObject);
  }
  info.sortedTags = [];
  for (tag in info.tags) {
    info.sortedTags.push(info.tags[tag]);
  }
  info.sortedTags = info.sortedTags.sort(function (tag1, tag2) {
    if (tag1.uses < tag2.uses) return 1;
    if (tag1.uses > tag2.uses) return -1;
    return 0;
  });
}

/**
 * @param {string} str Capitalized Sentence Case String
 * @returns {string} camelCaseString
 */
function toCamelCase(str) {
  return str
    .replace(/(?:^\w|[A-Z]|\b\w)/g, function (word, index) {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

/**
 * Converts from Sentence Case field names, which make the yaml like a bit prettier
 * @param {Object} obj JSON object with Capitalized Sentance Case field names
 * @returns {Object} obj, but with camelCase field names
 *
 */
function convertJsonCases(obj) {
  let key, convertedKey;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      convertedKey = toCamelCase(key);
      if (convertedKey !== key) {
        obj[convertedKey] = obj[key];
        delete obj[key];
      }
      if (typeof obj[convertedKey] === "object") {
        convertJsonCases(obj[convertedKey]);
      }
    }
  }
}

/**
 * @param {Desc} obj
 * @param {?DisplayContext} displayContext
 * @returns {number} A score, the higher the better, for determining
 * how good a fit the description is for the given display context
 */
function scoreGivenDisplayContext(obj, displayContext) {
  let score = "importance" in obj ? obj.importance : DEFAULT_IMPORTANCE;
  if ("text" in obj) {
    if (obj.text.length < 200) {
      score += (200 - obj.text.length) / 100;
    }
  }
  if (displayContext) {
    if (displayContext.parsedTags && obj.parsedTags) {
      score -= 10;
      for (i in displayContext.parsedTags) {
        const tag = displayContext.parsedTags[i];

        if (
          obj.parsedTags.some(function (objTag) {
            return objTag.id === tag;
          })
        ) {
          score += 40;
        }
      }
    }
  }
  return score;
}

/**
 * @param {Array.<Desc>} descs
 * @param {?DisplayContext} displayContext
 * @returns {string} Best text discription from the list of descriptions
 */
function findBestDescription(descs, displayContext) {
  let bestDesc = { text: "" };
  let maxScore = 0;
  for (i in descs) {
    const desc = descs[i];
    const descScore = scoreGivenDisplayContext(desc, displayContext);
    if (descScore > maxScore) {
      bestDesc = desc;
      maxScore = descScore;
    }
  }
  return bestDesc.text;
}

/**
 * @param {Tag} tag
 * @param {?DisplayContext} displayContext
 * @returns {string} HTML content for displaying the button that toggles the tag within the display context
 * (When the tag is selected, the resume will be redisiplayed, focusing on the tag)
 */
function createTagButton(tag, displayContext) {
  let newDisplayContext = {
    tags: [tag.id],
  };

  let selected = false;
  if (displayContext) {
    const newTags = displayContext.tags ? displayContext.tags.slice() : null;
    if (newTags) {
      const index = newTags.indexOf(tag.id);
      if (index == -1) {
        newTags.push(tag.id);
      } else {
        selected = true;
        newTags.splice(index, 1);
      }
    }
    newDisplayContext = {
      search: displayContext.search,
      tags: newTags,
    };
  }
  const jsonDisplayContext = JSON.stringify(newDisplayContext);

  return `<span class="${
    selected ? "tagButton selected" : "tagButton"
  }" onclick='displayResume(${jsonDisplayContext})''>
        ${tag.title}
    </span>`;
}

/**
 * Returns true if the context has a list of tags and one of the tags (or the aliases of those tags)
 * matches the given search
 * @param {ContextInfo} context
 * @param {string} search
 * @returns {boolean}
 */
function searchGivenTags(context, search) {
  for (i in context.parsedTags) {
    const tag = info.tags[context.parsedTags[i]];
    if (
      tag.id.indexOf(search) != -1 ||
      tag.aliases.some(function (s) {
        return s.indexOf(search) != -1;
      })
    ) {
      return true;
    }
  }

  return false;
}
/**
 * Returns true if the context has a list of descriptions and one of the descriptions contains the
 * provided search text
 * @param {ContextInfo} context
 * @param {string} search
 * @returns {boolean}
 */
function searchGivenDescs(context, search) {
  for (i in context.parsedDescs) {
    const desc = context.parsedDescs[i];
    if (desc.text.toLowerCase().indexOf(search) != -1) {
      return true;
    }
  }
  return false;
}

function searchGivenProjects(context, search) {
  if ("projects" in context) {
    return context.projects.some(function (proj) {
      return searchGivenTags(proj, search) || searchGivenDescs(proj, search);
    });
  }
}

/**
 * Returns true if the context has an array of {@link Tag}s and some of those tags
 * match the tag array passed in
 * @param {ContextInfo} context
 * @param {Array.<Tag>} tags
 * @returns {boolean}
 */
function tagIntersection(context, tags) {
  return (
    "tags" in context &&
    context.parsedTags.some(function (tag) {
      return tags.has(tag.id);
    })
  );
}
/**
 * Returns true if the context has an array of {@link Desc}s and some of those descs
 * have some of the tags
 * @param {ContextInfo} context
 * @param {Array.<Tag>} tags
 * @returns {boolean}
 */
function descsHaveTags(context, tags) {
  return (
    "descs" in context &&
    context.parsedDescs.some(function (desc) {
      return tagIntersection(desc, tags);
    })
  );
}

/**
 * Returns true if the context has a projects array, either {@link YamlCompanyProject}
 * or {@link YamlPersonalProject}, and some of the projects have a matching tag.
 * This is used in {@link shouldDisplayContext} to determine whether or not to show
 * @param {ContextInfo} context
 * @param {Array.<Tag>} tags
 * @returns {boolean}
 */
function projectsHaveTags(context, tags) {
  return (
    "projects" in context &&
    context.projects.some(function (proj) {
      return tagIntersection(proj, tags) || descsHaveTags(context, tags);
    })
  );
}

/**
 * Determines whether a specific context value should actually be displayed
 * @param {ContextInfo} context
 * @param {DisplayContext} displayContext
 * @returns {boolean} whether it should be displayed
 */
function shouldDisplayContext(context, displayContext) {
  let shouldDisplay = true;
  if (!displayContext) {
    if (context.importance) {
      shouldDisplay = shouldDisplay && context.importance > MINIMUM_IMPORTANCE;
    }
  } else {
    if (displayContext.search) {
      const search = displayContext.search.toLowerCase();
      shouldDisplay =
        shouldDisplay &&
        (searchGivenTags(context, search) ||
          searchGivenDescs(context, search) ||
          searchGivenProjects(context, search));
    }
    if (displayContext.tags && displayContext.tags.length > 0) {
      const tagSet = new Set(displayContext.tags);
      shouldDisplay =
        shouldDisplay &&
        (tagIntersection(context, tagSet) ||
          descsHaveTags(context, tagSet) ||
          projectsHaveTags(context, tagSet));
    }
  }
  return shouldDisplay;
}

/**
 * Recursive pair with {@link hydrateElements} which populates data in a given element
 * @param {HTMLElement} element
 * @param {ContextInfo} context
 * @param {DisplayContext} displayContext Context used to determine whether or not
 * a particular element will be displayed
 * @returns {HTMLElement}
 */
function hydrateElement(element, context, displayContext) {
  const newNode = element.cloneNode(true);
  if ("classList" in element) {
    const classList = element.classList;

    for (contextField in context) {
      if (classList.contains(contextField)) {
        // hydrate element with known value
        const contextVal = context[contextField];
        if (element.innerHTML === "") {
          // Empty elements will have their contents directly populated with the context value
          if (Array.isArray(contextVal)) {
            newNode.innerHTML = contextVal.join(", ");
          } else if (newNode.classList.contains("link")) {
            newNode.innerHTML = linkifyField(context, contextField);
          } else {
            newNode.innerHTML = contextVal;
          }
          return newNode;
        } else {
          // But if it is not empty, the child elements will be recursively populated
          return hydrateElements(
            newNode,
            contextVal,
            displayContext,
            ALWAYS_SHOWN_DATA.has(contextField)
          );
        }
      }
    }

    if (classList.contains("desc")) {
      newNode.innerHTML = findBestDescription(
        context.parsedDescs,
        displayContext
      );
    } else if (classList.contains("tagButton")) {
      newNode.innerHTML = createTagButton(context, displayContext);
      newNode.classList = [];
    } else if (element.children.length > 0) {
      // recursively search for elements to hydrate
      newNode.innerHTML = "";
      for (let j = 0; j < element.childNodes.length; j++) {
        newNode.appendChild(
          hydrateElement(element.childNodes[j], context, displayContext)
        );
      }
    }
  }

  return newNode;
}

/**
 * Recursively iterates through the child elements of `element`,
 * displaying values that are specified in one of the contexts if
 * the child element has a class name that matches a field in the
 * context - and it is decided that the given context object _should_ be displayed
 *
 * @param {?HTMLElement} element element to be replaced with a hydrated version of itself
 * @param {Array.<ContextInfo>} contexts list of context objects that will be traversed
 * @param {DisplayContext} displayContext
 * @param {?boolean} forceDisplay If set to true, will override. Also, the meta field will always show
 * @returns a new HTML Element node with the values set, set in the dom in the same place as `element`
 */
function hydrateElements(element, contexts, displayContext, forceDisplay) {
  const newNode = element.cloneNode(true);
  newNode.innerHTML = "";

  for (const i in contexts) {
    const context = contexts[i];
    if (typeof context !== "object") {
      console.warn("hey not an object", context);
      continue;
    }
    if (
      forceDisplay ||
      "meta" in context ||
      shouldDisplayContext(context, displayContext)
    ) {
      let heading = null;
      for (let j = 0; j < element.childNodes.length; j++) {
        const child = element.childNodes[j];
        if (child.classList && child.classList.contains("heading")) {
          heading = child.cloneNode(true);
        } else if (child.children) {
          const hydratedChild = hydrateElement(child, context, displayContext);
          if (heading != null && hydratedChild.innerHTML) {
            newNode.appendChild(heading);
          }
          newNode.appendChild(hydratedChild);
          heading = null;
        } else {
          newNode.appendChild(child.cloneNode(true));
        }
      }
    }
  }
  element.replaceWith(newNode);
  return newNode;
}

/**
 * Displays the resume by hydrating the #resume element in index.html
 * On first display, copies the resume structure to an #resume-mirror object
 * that is not visible but maintains structure
 * @param {?DisplayContext} displayContext
 */
function displayResume(displayContext) {
  const rootMirror = document.getElementById("resume-mirror");

  const root = document.getElementById("resume");
  if (rootMirror) {
    const newRoot = rootMirror.cloneNode(true);
    newRoot.style.cssText = "";
    root.replaceWith(newRoot);
    newRoot.id = "resume";
    hydrateElements(newRoot, [info], displayContext, true);
  } else {
    const mirror = root.cloneNode(true);
    mirror.style.cssText = "display: none";
    mirror.id = "resume-mirror";
    root.parentElement.appendChild(mirror);
    hydrateElements(root, [info], displayContext, true);
  }
}

/**
 * - Loads resume.yaml
 * - Uses jsyaml to parse it into a json object
 * - uses convertJsonCases to fix the field casing
 * - uses parseResume to populate the info object
 * - uses displayResume to display the resume
 */
function retrieveResume() {
  var client = new XMLHttpRequest();
  client.open("GET", "/resume.yaml");
  client.addEventListener("load", function () {
    var resumeObjects = jsyaml.load(client.responseText);
    convertJsonCases(resumeObjects);

    parseResume(resumeObjects);
    displayResume();
  });
  client.send();
}

retrieveResume();

// Functionality to allow for swapping between different styles
window.onload = function () {
  function setTheme(theme) {
    document.getElementsByTagName("body")[0].classList = [theme];
  }
  /**
   * @type {Array.<string>} List of themes.
   * Themes should have a button with ID in index.html (e.g. <button id="casual">Casual</button>
   * and a css block in style.css that defines CSS vars
   * ...for now, there are no themes, so it defaults to the ::root block of var definitions
   */
  const themes = [];
  for (i in themes) {
    const theme = themes[i];
    console.log(theme, document.getElementById(theme));
    document.getElementById(theme).addEventListener("click", function () {
      setTheme(theme);
    });
  }
};
