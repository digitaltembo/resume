/*
type Tag = string | [string, number];
type Desc = string | {|
    Tags: Array<Tag>,
    Text: string
|};

type Job = {|
    Company: string,
    Alias?: string,
    Title: string,
    Time: string,
    Tags: Array<Tag>,
    Descs?: Array<Desc>
|};
type CompanyProject = {|
    Company: string,
    Tags: Array<Tag>,
    Descs: Array<Desc>
|};
type PersonalProject = {|
    Title: string,
    Tags: Array<Tag>,
    Descs: Array<Desc>
|};
type Education = {|
    Name: string,
    Location: string,
    Degree: string,
    Majors: Array<string>,
    Minors: Array<string>,
    GPA: string,
    Accolades: Array<string>
|};

type DisplayContext = undefined | {|
    tags: Array<string>, 
    search: string,

|};
*/

const DEFAULT_IMPORTANCE = 50;
const MINIMUM_IMPORTANCE = 30;
const LINKED_META_FIELDS = ['linkedIn', 'gitHub', 'email'];

const info = {
    companies: {},
    personalProjects: [],
    educations: [],
    tags: {},
    sortedTags: [],
    meta: {}
};

function error(msg) {
    console.log(msg);
}

function sortByFields(array, fields) {
    return array.sort(function(a1, a2) {
        for(i in fields) {
            const field = fields[i];
            if (a1[field] < a2.field) return 1;
            if (a1[field] > a2.field) return -1;
        }
        return 0;
    });
}

function prettyFormat(text) {
    // Basically a light markdown formatter, adding _italic_, *bold*, and `preformatted` text and bullets
    return text.replace(/_(.+)_/g, '<i>$1</i>')
               .replace(/\*(.+)\*/g, '<b>$1</b>')
               .replace(/`(.+)`/g, '<code>$1</code>'); 

}

function addTag(tag, aliases) {
    const lTag = tag.toLowerCase();
    const uses = (lTag in info.tags) ? info.tags[lTag].uses + 1 : 1;
    if (aliases || ! (lTag in info.tags)) {
       info.tags[lTag] = {
            title: tag,
            id: lTag,
            aliases: aliases,
            uses: uses
        } 
    }
    return info.tags[lTag];
}
function parseTags(tags) {
    const parsedTags = [];
    for (i in tags) {
        const tag = tags[i];
        let importance = DEFAULT_IMPORTANCE;
        let tagText;
        if (typeof tag == 'string') {
            tagText = tag;
        } else {
            tagText = tag[0];
            importance = tag[1];
        }
        const canonicalTag = addTag(tagText, []);

        parsedTags.push({
            id: canonicalTag.id,
            importance: importance
        });
    }
    return parsedTags;
}

function parseDescs(descs) {
    const parsedDescs = [];
    for (i in descs) {
        const desc = descs[i];
        let tags = [];
        let importance = DEFAULT_IMPORTANCE;
        let text = '';
        if (typeof desc !== 'string') {
            text = desc.text;
            if ('tags' in desc) {
                tags = parseTags(desc.tags);
            }
            if ('importance' in desc) {
                importance = desc.importance;
            }
        } else {
            text = desc;
        }
        text = prettyFormat(text);
        parsedDescs.push({
            text: text,
            tags: tags,
            importance: importance,
            length: text.length
        });
    }

    parsedDescs.sort(function(d1, d2) {
        if (d1.importance < d2.importance) {

        }
    })

    return parsedDescs;
}

function addTagsAndDescs(obj) {
    obj.tags = parseTags(obj.tags);
    obj.descs = parseDescs(obj.descs);
}

function parseJob(job) {
    addTagsAndDescs(job);
    job.projects = [];
    if('alias' in job) {
        info.companies[job.alias] = job;
    } else {
        info.companies[job.company] = job;
    }
}

function parseCompanyProject(proj) {
    if (!proj.companyProject in info.companies) {
        error(`Expected to find a job by the name of ${rpoj.companyProject}`);
        return;
    }
    addTagsAndDescs(proj);
    info.companies[proj.companyProject].projects.push(proj);
}

function parsePersonalProject(proj) {
    addTagsAndDescs(proj);
    info.personalProjects.push(proj);
}

function parseEducation(edu) {
    info.educations.push(edu);
}
function parseTag(tag) {
    addTag(tag.tag, tag.aliases);
}

function linkifyField(obj, field) {
    if (field in obj) {
        const url = obj[field];
        const href = (url.indexOf('@') != -1) ? 
            'mailto:' + url : 
            'https://' + url;

        obj[field] = `<a href="${href}" target="_blank">${url}</a>`;
    }
}

function parseMeta(meta) {
    for (i in LINKED_META_FIELDS) {
        linkifyField(meta, LINKED_META_FIELDS[i]);
    }
    meta.descs = parseDescs(meta.descs);
    info.meta = [meta];
}

function parseResumeObject(obj) {
    if('company' in obj) {
        parseJob(obj);
    }
    else if('companyProject' in obj) {
        parseCompanyProject(obj);
    }
    else if('personalProject' in obj) {
        parsePersonalProject(obj);
    }
    else if('education' in obj) {
        parseEducation(obj);
    }
    else if('tag' in obj) {
        parseTag(obj);
    }
    else if('meta' in obj) {
        parseMeta(obj.meta);
    }
    else {
        error(`Could not parse resume, ${obj} is invalid`);
    }
}

function parseResume(resumeObjects) {

    console.log(resumeObjects);
    let resumeObject;

    for(i in resumeObjects) {
        parseResumeObject(resumeObjects[i]);
    }
    info.sortedTags = [];
    for(tag in info.tags) {
        info.sortedTags.push(info.tags[tag]);
    }
    info.sortedTags = info.sortedTags.sort(function(tag1, tag2) { 
        if(tag1.uses < tag2.uses) return 1;
        if(tag1.uses > tag2.uses) return -1;
        return 0;
    });
}

function toCamelCase(str) {
    return str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
        return index === 0 ? word.toLowerCase() : word.toUpperCase();
    }).replace(/\s+/g, '');
}

function convertJsonCases(obj) {
    let key, convertedKey;
    for (key in obj) {
        if (obj.hasOwnProperty(key)) {
            convertedKey = toCamelCase(key);
            if (convertedKey !== key) {
                obj[convertedKey] = obj[key];
                delete(obj[key]);
            }
            if (typeof obj[convertedKey] === "object") {
                convertJsonCases(obj[convertedKey]);
            }
        }
    }
}

function scoreGivenDisplayContext(obj, displayContext) {
    let score = ('importance' in obj) ? obj.importance : DEFAULT_IMPORTANCE;
    if ('text' in obj) {
        if (obj.text.length < 200){
            score += (200 - obj.text.length) / 100;
        }
    }
    if (displayContext) {
        if (displayContext.tags && obj.tags) {
            score -= 10;
            for (i in displayContext.tags) {
                const tag = displayContext.tags[i];

                if (obj.tags.some(function(objTag){
                    return objTag.id === tag;
                })) {
                    score += 40;
                }
            }
        }
    }
    return score;
}   
function findBestDescription(descs, displayContext) {
    let bestDesc = {text: ''};
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

function createTagButton(tag, displayContext) {
    let newDisplayContext = {
        tags: [tag.id]
    };

    let selected = false;
    if (displayContext) {

        const newTags = displayContext.tags ? 
            displayContext.tags.slice() : null;
        if (newTags) {
            const index = newTags.indexOf(tag.id)
            if (index == -1) {
                newTags.push(tag.id);
            } else {
                selected = true;
                newTags.splice(index, 1);
            }
        }
        newDisplayContext = {
            search: displayContext.search,
            tags: newTags
        }

    }
    const jsonDisplayContext = JSON.stringify(newDisplayContext);
    console.log(jsonDisplayContext);
    return `<span class="${selected ? 'tagButton selected' : 'tagButton'}" onclick='displayResume(${jsonDisplayContext})''>
        ${tag.title}
    </span>`;
}

const alwaysShownData = new Set(['meta', 'sortedTags']);
function alwaysShown(field) {
    return alwaysShownData.has(field);
}
function hydrateElement(element, context, displayContext) {

    const newNode = element.cloneNode(true);
    if ('classList' in element) {
        const classList = element.classList;

        for (contextField in context) {
            if (classList.contains(contextField)) {
                // hydrate element with known value
                const contextVal = context[contextField];
                if (element.innerHTML === '') {
                    if (Array.isArray(contextVal)) {
                        newNode.innerHTML = contextVal.join(', ');
                    } else {
                        newNode.innerHTML = contextVal;
                    }
                    return newNode;
                } 
                else {
                    return hydrateElements(newNode, contextVal, displayContext, alwaysShown(contextField));
                }
            }
        }

        if (classList.contains('desc')) {
            newNode.innerHTML = findBestDescription(context.descs, displayContext);
        }
        else if(classList.contains('tagButton')) {
            newNode.innerHTML = createTagButton(context, displayContext);
            newNode.classList = [];
        }
        else if (element.children.length > 0) {
            // recursively search for elements to hydrate
            newNode.innerHTML = '';
            for(let j = 0; j < element.childNodes.length; j++){
                newNode.appendChild(hydrateElement(element.childNodes[j], context, displayContext));
            }
        }
    }

    return newNode;

}

function searchGivenTags(context, search) {
    for (i in context.tags) {
        const tag = info.tags[context.tags[i]]
        if (tag.id.indexOf(search) != -1 || tag.aliases.some(function(s){
            return s.indexOf(search) != -1;
        })){
            return true;
        }
    }

    return false;
}

function searchGivenDescs(context, search) {
    for (i in context.descs) {
        const desc = context.descs[i];
        if(desc.text.toLowerCase().indexOf(search) != -1) {
            return true;
        }
    }
    return false;
}

function searchGivenProjects(context, search) {
    if ('projects' in context) {
        return context.projects.some(function(proj) {
            return searchGivenTags(proj, search) || searchGivenDescs(proj, search);
        });
    }
}

function tagIntersection(context, tags) {
    return 'tags' in context && context.tags.some(function(tag) {
        return tags.has(tag.id);
    });
}
function descsHaveTags(context, tags) {
    return 'descs' in context && context.descs.some(function(desc) {
        return tagIntersection(desc, tags);
    })
}
function projectsHaveTags(context, tags) {
    return 'projects' in context && context.projects.some(function(proj) {
        return tagIntersection(proj, tags) || descsHaveTags(context, tags);
    })
}

function shouldDisplayContext(context, displayContext) {
    let shouldDisplay = true;
    if (!displayContext) {
        if (context.importance) {
            shouldDisplay = shouldDisplay && context.importance > MINIMUM_IMPORTANCE;
        }
    }
    else {
        if (displayContext.search) {
            const search = displayContext.search.toLowerCase();
            shouldDisplay = shouldDisplay && (
                searchGivenTags(context,     search) ||
                searchGivenDescs(context,    search) ||
                searchGivenProjects(context, search)
            );
        }
        if (displayContext.tags && displayContext.tags.length > 0) {
            const tagSet = new Set(displayContext.tags);
            shouldDisplay = shouldDisplay && (
                tagIntersection(context,  tagSet) ||
                descsHaveTags(context,    tagSet) ||
                projectsHaveTags(context, tagSet)
            );
        }
    }
    return shouldDisplay;


}

function hydrateElements(element, obj, displayContext, forceDisplay) {
    const newNode = element.cloneNode(true);
    newNode.innerHTML = '';
    for (i in obj) {
        const context = obj[i];
        if (forceDisplay || 'meta' in context || shouldDisplayContext(context, displayContext)) {
            let heading = null;
            for(let j = 0; j < element.childNodes.length; j++){
                const child = element.childNodes[j];
                if (child.classList && child.classList.contains('heading')) {
                    heading = child.cloneNode(true);
                } else if (child.children) {
                    const hydratedChild = hydrateElement(child, context, displayContext);
                    if (heading != null  && hydratedChild.innerHTML) {
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
// function addFilters(displayContext) {
//     const filtersElem = document.querySelector('#resume .filters');
//     for(i in info.tags) {
//         const tag = info.tags[i];

//     }
// }
function displayResume(displayContext) {
    const rootMirror = document.getElementById("resume-mirror");

    const root = document.getElementById("resume");
    if (rootMirror) {
        console.log('yep!');
        const newRoot = rootMirror.cloneNode(true);
        newRoot.style.cssText = "";
        root.replaceWith(newRoot);
        newRoot.id = "resume";
        hydrateElements(newRoot, [info], displayContext, true);
    } else {
        console.log('nope!');
        const mirror = root.cloneNode(true);
        mirror.style.cssText = "display: none";
        mirror.id = "resume-mirror";
        root.parentElement.appendChild(mirror);
        hydrateElements(root, [info], displayContext, true);
    }
   // addFilters(displayContext):
}

function retrieveResume() {
    var client = new XMLHttpRequest();
    client.open('GET', '/resume.yaml');
    client.addEventListener("load", function() {
        var resumeObjects = jsyaml.load(client.responseText);
        convertJsonCases(resumeObjects);

        parseResume(resumeObjects);
        displayResume();
    });
    client.send();
}

retrieveResume();

window.onload = function() {

    function setTheme(theme) {
        console.log('huh');
        document.getElementsByTagName('body')[0].classList=[theme];
    }
    const themes = ['dark-mode', 'professional', 'casual'];
    for (i in themes) {
        const theme = themes[i];
        console.log(theme, document.getElementById(theme));
        document.getElementById(theme).addEventListener('click', function(){
            setTheme(theme);
        });
    }
}


