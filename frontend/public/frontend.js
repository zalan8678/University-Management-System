// on startup fetch and display all pre-existing data
window.addEventListener("DOMContentLoaded", async () => {
    const res = await fetch("/api/v1/orgs");
    const orgs = await res.json();

    for (const org of orgs) { // displays every org
        document.body.appendChild(createOrgNode(org)); // appends to page
    }
});

function createOrgNode(org) { // we're given an org
    const detailsNode = document.createElement("details"); 
    const summaryNode = document.createElement("summary");

    summaryNode.textContent = org.name;
    detailsNode.appendChild(summaryNode);

    let loaded = false; // start of ai

    detailsNode.addEventListener("toggle", async () => {
        if (!detailsNode.open || loaded) return;
        loaded = true; // end of ai


        // ATTACH COURSES IF EXPANDED
        const res = await fetch(`/api/v1/orgs/${org.id}/courses`);
        const courses = await res.json();

        for (const course of courses) {
            detailsNode.appendChild(createCourseNode(org.id, course));
        }
    }); 

    return detailsNode; // returns stuff for them to append
}

function createCourseNode(orgId, course) { // given orgid, course
    const detailsNode = document.createElement("details"); 
    const summaryNode = document.createElement("summary");

    summaryNode.textContent = `${course.dept} ${course.code} - ${course.title}`; // whats shown
    detailsNode.appendChild(summaryNode); // appends to node

    let loaded = false; // start of ai

    detailsNode.addEventListener("toggle", async () => {
        if (!detailsNode.open || loaded) return;
        loaded = true; // end of ai

        // ATTACH SECTIONS IF EXPANDED
        const res = await fetch(`/api/v1/orgs/${orgId}/courses/${course.id}/sections`);
        const sections = await res.json();

        for (const section of sections) {
            detailsNode.appendChild(createSectionNode(course.id, section));
        }
    }); 

    return detailsNode;
}

function createSectionNode(courseId, section) {
    const div = document.createElement("div"); // start of ai
    div.style.marginLeft = "20px"; 

    div.textContent =
    `${section.instructor} (${section.year}) — ` +
    `Avg: ${section.avg}, Pass: ${section.pass}, Fail: ${section.fail}, Audit: ${section.audit}`; // end of ai
    
    return div; // no need to append bc last one
}
