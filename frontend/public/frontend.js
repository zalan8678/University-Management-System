/*// on startup fetch and display all pre-existing data
window.addEventListener("DOMContentLoaded", async () => {
    const res = await fetch("/api/v1/orgs");
    const orgs = await res.json();

    // --- ADD ORG BUTTON ---
    const orgAddBtn = document.createElement("button");
    orgAddBtn.textContent = "Add / Update Organization";
    orgAddBtn.style.marginLeft = "10px"; // styling

    orgAddBtn.onclick = async (e) => {

        const orgId = prompt("Please provide a OrgId (the organization identifier)");
        const name = prompt("Please provide the name of the organization");

        if (!orgId || orgId.trim() === "" || !name || name.trim() === "") {
            alert("Unsuccessful: Missing Field");
            return;
        }

        const res = await fetch(`/api/v1/orgs/${orgId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });

        if (res.status == 201) {
            const newOrg = await res.json();
            document.body.appendChild(createOrgNode(newOrg));
            alert("Successfully created");
        } else if (res.status == 204) {
            alert("Successfully updated");
        } else if (res.status == 422) {
            const error = await res.json();
            alert(`Validation failed: ${error.message}`);
        };

        location.reload();
    }

    document.body.appendChild(orgAddBtn);
    document.body.appendChild(document.createElement("br"));


    // --- RENDERING ---

    document.body.appendChild(document.createElement("br"));

    for (const org of orgs) { // displays every org
        document.body.appendChild(createOrgNode(org)); // appends to page
        document.body.appendChild(document.createElement("br"));
    }
});

function createOrgNode(org) { // we're given an org

    // --- RENDERING ---

    const detailsNode = document.createElement("details");
    const summaryNode = document.createElement("summary");

    summaryNode.textContent = `${org.name} - ${org.id}`;
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

    // --- ADD COURSE BUTTON ---
    const courseAddBtn = document.createElement("button");
    courseAddBtn.textContent = "Add / Update Course";
    courseAddBtn.style.marginLeft = "10px"; // styling

    courseAddBtn.onclick = async (e) => {

        const courseId = prompt("Please provide a CourseId (the course identifier)");
        const title = prompt("Please provide the title of the course");
        const dept = prompt("Please provide the department that offers the course");
        const code = prompt("Please provide the course code identifier");

        if (!courseId || courseId.trim === "" || !title || title.trim() === "" || !dept || dept.trim() === "" || !code || code.trim() === "") {
            alert("Unsuccessful: Missing Field");
            return;
        }

        const res = await fetch(`/api/v1/orgs/${org.id}/courses/${courseId}`, {
            method: 'PUT',
            headers: {"Content-Type": "application/json",},
            body: JSON.stringify({title, dept, code})
        });

        if (res.status == 201) {
            const newCourse = await res.json();
            detailsNode.appendChild(createCourseNode(org.id, newCourse));
            alert("Successfully created");
        } else if (res.status == 204) {
            alert("Successfully updated");
        } else if (res.status == 422) {
            const error = await res.json();
            alert(`Validation failed: ${error.message}`);
        };

        location.reload();

    };

    summaryNode.appendChild(courseAddBtn); // add button

    // --- DELETE ORG BUTTON ---

    const orgDelBtn = document.createElement("button");
    orgDelBtn.textContent = "Delete Org";
    orgDelBtn.style.marginLeft = "10px"; // styling

    orgDelBtn.onclick = async (e) => {
        await fetch(`/api/v1/orgs/${org.id}`, {method: 'DELETE'}) // delete org - ASYNC
        detailsNode.remove(); // remove this
    };

    summaryNode.appendChild(orgDelBtn); // add button

    return detailsNode; // returns stuff for them to append
}

function createCourseNode(orgId, course) { // given orgid, course
    const detailsNode = document.createElement("details");
    const summaryNode = document.createElement("summary");

    summaryNode.textContent = `${course.dept} ${course.code} - ${course.title} - ${course.id}`; // whats shown
    detailsNode.appendChild(summaryNode); // appends to node

    let loaded = false; // start of ai

    detailsNode.addEventListener("toggle", async () => {
        if (!detailsNode.open || loaded) return;
        loaded = true; // end of ai

        // ATTACH SECTIONS IF EXPANDED
        const res = await fetch(`/api/v1/orgs/${orgId}/courses/${course.id}/sections`);
        const sections = await res.json();

        for (const section of sections) {
            detailsNode.appendChild(createSectionNode(orgId, course.id, section));
        }
    });


    // --- ADD SECTION BUTTON ---
    const sectionAddBtn = document.createElement("button");
    sectionAddBtn.textContent = "Add / Update Section";
    sectionAddBtn.style.marginLeft = "10px"; // styling

    sectionAddBtn.onclick = async (e) => {

        const sectionId = prompt("Please provide a SectionId (the section identifier)");
        const instructor = prompt("Please provide the instructor's full name.");
        const year = Number(prompt("Please provide the year in which the section was offered."));
        const avg = Number(prompt("Please provide the average grade of students enroled in the section"));
        const pass = Number(prompt("Please provide the number of students in the section who achieved a passing grade"));
        const fail = Number(prompt("Please provide the number of students in the section who did not achieved a passing grade"));
        const audit = Number(prompt("The number of students in the section who audited the course."));

        if (!sectionId || sectionId.trim() === "" || !instructor || instructor.trim() === "") {
            alert("Unsuccessful: Missing Field");
            return;
        }

        const res = await fetch(`/api/v1/orgs/${orgId}/courses/${course.id}/sections/${sectionId}`, {
            method: 'PUT',
            headers: {"Content-Type": "application/json",},
            body: JSON.stringify({instructor, year, avg, pass, fail, audit})
        });

        if (res.status == 201) {
            const newSection = await res.json();
            detailsNode.appendChild(createSectionNode(orgId, course.id, newSection));
            alert("Successfully created");
        } else if (res.status == 204) {
            alert("Successfully updated");
        } else if (res.status == 404) {
            alert("Error 404: Not Found");
        } else if (res.status == 422) {
            alert("Error 422: Validation Failed");
        };

        location.reload();

    };

    summaryNode.appendChild(sectionAddBtn); // add button

    // --- DELETE COURSE BUTTON ---

    const courseDelBtn = document.createElement("button");
    courseDelBtn.textContent = "Delete Course";
    courseDelBtn.style.marginLeft = "10px"; // styling

    courseDelBtn.onclick = async (e) => {
        await fetch(`/api/v1/orgs/${orgId}/courses/${course.id}`, {method: 'DELETE'}) // delete org - ASYNC
        detailsNode.remove(); // remove this
    };

    summaryNode.appendChild(courseDelBtn); // add button

    return detailsNode;
}

function createSectionNode(orgId, courseId, section) {
    const div = document.createElement("div"); // start of ai
    div.style.marginLeft = "20px";

    div.textContent =
    `${section.instructor} (${section.year}) - ${section.id} - ` +
    `Avg: ${section.avg}, Pass: ${section.pass}, Fail: ${section.fail}, Audit: ${section.audit}`; // end of ai

    // --- DELETE SECTION BUTTON ---

    const sectionDelBtn = document.createElement("button");
    sectionDelBtn.textContent = "Delete Section";
    sectionDelBtn.style.marginLeft = "10px"; // styling

    sectionDelBtn.onclick = async (e) => {
        await fetch(`/api/v1/orgs/${orgId}/courses/${courseId}/sections/${section.id}`, {method: 'DELETE'}) // delete org - ASYNC
        div.remove(); // remove this
    };

    div.appendChild(sectionDelBtn); // add button


    return div; // no need to append bc last one
}*/

window.addEventListener("DOMContentLoaded", async () => {
	const res = await fetch("/api/v1/courses");
	const courses = await res.json();

	document.body.appendChild(document.createElement("br"));

	for (const course of courses.items) {
		const res2 = await fetch(`/api/v1/courses/${course.id}/sections`);
		let sections = await res2.json();
		for (const section of sections.items) {
			document.getElementById("myTable").appendChild(createSectionRow(course, section)); // appends to page
		}
	}
});

// Generated by AI
function createSectionRow(course, section) {
	const tr = document.createElement("tr");

	const dept = document.createElement("td");
	dept.textContent = course.dept;

	const code = document.createElement("td");
	code.textContent = course.code;

	const title = document.createElement("td");
	title.textContent = course.title;

	const year = document.createElement("td");
	year.textContent = section.year;

	const instructor = document.createElement("td");
	instructor.textContent = section.instructor;

	const avg = document.createElement("td");
	avg.textContent = section.avg;

	tr.appendChild(dept);
	tr.appendChild(code);
	tr.appendChild(title);
	tr.appendChild(year);
	tr.appendChild(instructor);
	tr.appendChild(avg);

	return tr;
}
// End of AI Code

async function sortByAttribute(attribute) {
	const req = await fetch(`/api/v1/search`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			kind: "course_offerings",
			query: {
				WHERE: {
					IS: { dept: "*" },
				},
				OPTIONS: {
					COLUMNS: ["dept", "code", "title", "year", "instructor", "avg"],
					ORDER: attribute,
				},
			},
		}),
	});
	const result = await req.json();
	const parentElement = document.getElementById("myTable");
	while (parentElement.children.length > 1) {
		parentElement.removeChild(parentElement.lastChild);
	}
	for (const queryResult of result) {
		document.getElementById("myTable").appendChild(createSectionRow2(queryResult));
	}
}

function createSectionRow2(section) {
	const tr = document.createElement("tr");

	const dept = document.createElement("td");
	dept.textContent = section.dept;

	const code = document.createElement("td");
	code.textContent = section.code;

	const title = document.createElement("td");
	title.textContent = section.title;

	const year = document.createElement("td");
	year.textContent = section.year;

	const instructor = document.createElement("td");
	instructor.textContent = section.instructor;

	const avg = document.createElement("td");
	avg.textContent = section.avg;

	tr.appendChild(dept);
	tr.appendChild(code);
	tr.appendChild(title);
	tr.appendChild(year);
	tr.appendChild(instructor);
	tr.appendChild(avg);

	return tr;
}
