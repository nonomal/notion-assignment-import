export interface InputAssignment {
	name: string;
	course: string;
	url: string;
	available?: string;
	due?: string;
}

interface Constants {
	COURSE: string;
	CLASSES: {
		ASSIGNMENT: string;
		TITLE: string;
		AVAILABLE_DATE: string;
		AVAILABLE_STATUS: string;
		DUE_DATE: string;
		SCREENREADER_ONLY: string;
	};
	SELECTORS: {
		[key: string]: string;
	};
	VALUES: {
		NOT_AVAILABLE_STATUS: string;
	};
}

async function parseAssignments(courseCode: string): Promise<void> {
	const classSelector = (className: string): string => `.${className}`;

	const options = await chrome.storage.local.get({
		canvasAssignment: 'assignment',
		assignmentTitle: 'ig-title',
		availableDate: 'assignment-date-available',
		availableStatus: 'status-description',
		dueDate: 'assignment-due-date',
		dateElement: 'screenreader-only',
		notAvailableStatus: 'Not available until',
	});

	const CONSTANTS: Constants = {
		COURSE: courseCode,
		CLASSES: {
			ASSIGNMENT: options.canvasAssignment,
			TITLE: options.assignmentTitle,
			AVAILABLE_DATE: options.availableDate,
			AVAILABLE_STATUS: options.availableStatus,
			DUE_DATE: options.dueDate,
			SCREENREADER_ONLY: options.dateElement,
		},
		SELECTORS: {
			get AVAILABLE_STATUS() { return `${classSelector(CONSTANTS.CLASSES.AVAILABLE_DATE)} ${classSelector(CONSTANTS.CLASSES.AVAILABLE_STATUS)}`; },
			get AVAILABLE_DATE() { return `${classSelector(CONSTANTS.CLASSES.AVAILABLE_DATE)} ${classSelector(CONSTANTS.CLASSES.SCREENREADER_ONLY)}`; },
			get DUE_DATE() { return `${classSelector(CONSTANTS.CLASSES.DUE_DATE)} ${classSelector(CONSTANTS.CLASSES.SCREENREADER_ONLY)}`; },
		},
		VALUES: {
			NOT_AVAILABLE_STATUS: options.notAvailableStatus,
		},
	};

	function verifySelector(assignment: NonNullable<ReturnType<Element['querySelector']>>, selector: string): NonNullable<ReturnType<Element['querySelector']>> | void {
		const element = assignment.querySelector(selector);

		return (element)
			? element
			: alert(`Incorrect selector: ${selector}`);
	}

	function parseAvailableDate(assignment: NonNullable<ReturnType<Element['querySelector']>>): string {
		const availableStatus = assignment.querySelector(CONSTANTS.SELECTORS.AVAILABLE_STATUS);
		const availableDate = assignment.querySelector(CONSTANTS.SELECTORS.AVAILABLE_DATE);

		// If the AVAILABLE_STATUS class actually contains the 'available until' date, return an empty string
		if (availableStatus?.textContent?.trim() !== CONSTANTS.VALUES.NOT_AVAILABLE_STATUS) return '';

		return availableDate?.textContent?.trim() ?? '';
	}

	function parseAssignment(assignment: NonNullable<ReturnType<Element['querySelector']>>): InputAssignment | void {
		const assignmentTitle = verifySelector(assignment, classSelector(CONSTANTS.CLASSES.TITLE));

		// Ensure the configured selectors are valid
		if (!assignmentTitle?.textContent || !(assignmentTitle instanceof HTMLAnchorElement)) return;

		return {
			name: assignmentTitle.textContent.trim(),
			course: CONSTANTS.COURSE,
			url: assignmentTitle.href,
			available: parseAvailableDate(assignment),
			due: assignment.querySelector(CONSTANTS.SELECTORS.DUE_DATE)?.textContent?.trim() ?? '',
		};
	}

	const assignments = document.getElementsByClassName(CONSTANTS.CLASSES.ASSIGNMENT);

	const parsed = Object.values(assignments).map(assignment => parseAssignment(assignment));

	const { savedAssignments } = await chrome.storage.local.get({ savedAssignments: [] });

	if (savedAssignments.some((course: InputAssignment[]) => course[0].course === courseCode)) return;

	savedAssignments.push(parsed);

	chrome.storage.local.set({ savedAssignments });
}

const optionsButton = document.getElementById('optionsButton');

if (optionsButton) {
	optionsButton.addEventListener('click', async () => {
		if (chrome.runtime.openOptionsPage) {
			chrome.runtime.openOptionsPage();
		}

		else {
			window.open(chrome.runtime.getURL('options.html'));
		}
	});
}

const clearStorageButton = document.getElementById('clearStorageButton');

if (clearStorageButton) {
	clearStorageButton.addEventListener('click', async () => {
		chrome.storage.local.remove('savedAssignments');

		updateSavedCoursesList();
	});
}

const parseButton = document.getElementById('parseButton');

if (parseButton) {
	parseButton.addEventListener('click', async () => {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		const courseCodeInput = document.getElementById('courseCode');

		if (!tab.id || !courseCodeInput || !(courseCodeInput instanceof HTMLInputElement)) return;

		if (!courseCodeInput.value) return alert('You must enter the course code.');

		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: parseAssignments,
			args: [courseCodeInput.value],
		});

		updateSavedCoursesList();
	});
}

function updateSavedCoursesList() {
	const savedCourses = document.getElementById('savedCoursesList');

	if (savedCourses) {
		chrome.storage.local.get({ savedAssignments: [] }, ({ savedAssignments }) => {
			const coursesList = savedAssignments.reduce((list: string, course: InputAssignment[]) => list + `<li>${course[0].course}</li>\n`, '');

			savedCourses.innerHTML = (coursesList)
				? `<ol>${coursesList}</ol>`
				: '<p>No saved courses.</p>';
		});
	}
}

updateSavedCoursesList();