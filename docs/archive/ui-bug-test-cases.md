# Structured UI Bug Test Cases - MediQ Angular Application

Based on the browser testing workflow and Chrome DevTools MCP capabilities, here are structured test cases for common UI bugs:

## Test Case 1: Task Checkbox Animation Bug

**Title**: Task completion/strikethrough animation not working

**Priority**: High

### Preconditions
1. Angular app running at http://localhost:4200
2. At least 3 tasks exist in the system
3. Chrome DevTools MCP connected with isolated profile

### Test Steps

| Step | Action | Expected Result | DevTools Checks |
|------|--------|----------------|-----------------|
| 1 | Navigate to task list page | Page loads without errors | Console: no errors<br>Network: initial page load |
| 2 | Verify at least 3 tasks visible | Tasks rendered in DOM | DOM: task items present<br>Accessibility: tasks have accessible names |
| 3 | Click checkbox on first task | Task animates to completed section | Screenshot: before/after comparison<br>Console: no errors<br>Network: PATCH /api/tasks/:id with {status: "completed"} |
| 4 | Verify task moved to completed section | Task no longer in active list | DOM: task moved to correct section<br>Accessibility: status change announced |
| 5 | Click undo within 3 seconds | Task returns to active list with reverse animation | Screenshot: visual regression check<br>Console: no errors<br>Network: PATCH /api/tasks/:id with {status: "pending"} |
| 6 | Rapidly toggle same task 5 times | No visual glitches, final state consistent | DOM: exactly one instance of the task<br>Console: zero errors<br>Network: no duplicate requests |

### Pass/Fail Criteria
- ✅ Pass: All steps complete without console errors, network requests are correct, visual state matches expected
- ❌ Fail: Any console error, duplicate network request, visual glitch, or incorrect final state

### DevTools MCP Commands Pattern
```javascript
// Step 3 - After clicking checkbox
const consoleLogs = get_console_logs();
const errorLogs = filter_by_level(consoleLogs, "ERROR");
if (errorLogs.length > 0) {
    report("Console errors after checkbox click: " + errorLogs);
}

const networkEvents = get_network_events();
const patchRequests = filter_by_url(networkEvents, "/api/tasks");
if (patchRequests.length === 0) {
    report("WARNING: No PATCH request found after checkbox click");
} else if (patchRequests.length > 1) {
    report("WARNING: Duplicate PATCH requests detected");
} else {
    const request = patchRequests[0];
    if (request.response.status !== 200) {
        report("PATCH request failed with status: " + request.response.status);
    }
    if (!request.body.contains("{status: \"completed\"}")) {
        report("WARNING: PATCH body doesn't contain expected status");
    }
}

// Step 6 - After rapid toggling
const domTree = get_dom_node_tree();
const taskItems = query_selector_all(".task-item");
if (taskItems.length !== 1) {
    report("FAIL: Expected 1 task item, found " + taskItems.length);
}
```

---

## Test Case 2: Form Validation Bug

**Title**: Form validation errors not displaying correctly

**Priority**: High

### Preconditions
1. Angular app running at http://localhost:4200
2. On a form page (login, patient creation, etc.)
3. Chrome DevTools MCP connected

### Test Steps

| Step | Action | Expected Result | DevTools Checks |
|------|--------|----------------|-----------------|
| 1 | Navigate to form page | Page loads without console errors | Console: no errors on load |
| 2 | Submit form with all fields empty | Inline validation errors display | DOM: error messages visible<br>Accessibility: errors have aria-describedby |
| 3 | Check error message content | Messages match validation rules | Console: no validation errors<br>DOM: correct error text |
| 4 | Fill in required fields, submit | Form validates successfully | Network: no submit request (if invalid)<br>Or: submit succeeds if valid |
| 5 | Submit with invalid email format | Specific email error displays | DOM: "Please enter a valid email" message<br>Console: no errors |
| 6 | Hover over error messages | No unexpected behavior | Console: no hover-related errors |
| 7 | Tab through form fields | Focus order is logical | Accessibility: focus order correct<br>Console: no focus-related warnings |

### Pass/Fail Criteria
- ✅ Pass: All validation errors display correctly, form prevents submission on invalid data, accessible names on errors
- ❌ Fail: Error messages missing, form submits when invalid, focus order issues, console errors

### DevTools MCP Commands Pattern
```javascript
// Step 2 - Submit with empty fields
const consoleLogs = get_console_logs();
if (consoleLogs.length > 0) {
    const errors = filter_by_level(consoleLogs, "ERROR");
    if (errors.length > 0) {
        report("Unexpected console errors: " + JSON.stringify(errors));
    }
}

// Step 3 - Check error messages
const errorElements = query_selector_all(".error-message, .validation-error");
for (const error of errorElements) {
    const hasText = error.textContent.trim().length > 0;
    const hasAria = error.getAttribute("role") !== null;
    if (!hasText) {
        report("WARNING: Error element has no text content");
    }
    if (!hasAria) {
        report("WARNING: Error element missing ARIA role");
    }
}

// Step 5 - Invalid email
type_text("#email", "invalid-email");
click_element("#submit");
const networkEvents = get_network_events();
const submitRequests = filter_by_method(networkEvents, "POST");
if (submitRequests.length > 0 && submitRequests[0].response.status === 400) {
    // Expected - form should not submit with invalid data
    report("Form correctly prevented submission with invalid email");
}
```

---

## Test Case 3: Responsive Design Bug

**Title**: Layout breaks at mobile viewport

**Priority**: Medium

### Preconditions
1. Angular app running at http://localhost:4200
2. Chrome DevTools MCP with viewport set to 375x667 (iPhone size)
3. Page with responsive components

### Test Steps

| Step | Action | Expected Result | DevTools Checks |
|------|--------|----------------|-----------------|
| 1 | Set viewport to 375x667 (phone) | Page renders at mobile width | Screenshot: mobile viewport<br>Viewport: 375x667 |
| 2 | Navigate to page with grid layout | Grid adapts to mobile width | CSS: media queries active<br>DOM: grid items stack vertically |
| 3 | Check that no horizontal scrolling occurs | Content fits within viewport | Screenshot: no horizontal overflow<br>Computed style: overflow-x = "hidden" or "auto" |
| 4 | Check touch target sizes | Buttons/links >= 44x44 px | Element styles: min-width/height verification |
| 5 | Navigate back to desktop | Layout restores correctly | Screenshot: desktop comparison |
| 6 | Test at tablet size (768x1024) | Appropriate layout for tablet | Viewport: 768x1024<br>Screenshot: tablet layout |

### Pass/Fail Criteria
- ✅ Pass: No horizontal scrolling at mobile size, touch targets are adequate, layout adapts at all breakpoints
- ❌ Fail: Horizontal scrolling occurs, touch targets too small, layout breaks at any breakpoint

### DevTools MCP Commands Pattern
```javascript
// Set viewport to mobile size
set_viewport(width=375, height=667);

// Take screenshot
take_screenshot(file_name="mobile-viewport.png");

// Check for horizontal scrolling
const bodyStyle = get_computed_style("body", "overflow-x");
if (bodyStyle !== "hidden" && bodyStyle !== "auto") {
    report("WARNING: Body overflow-x is: " + bodyStyle);
}

// Check touch targets
const buttons = query_selector_all("button, a");
for (const button of buttons) {
    const rect = get_bounding_client_rect(button);
    const width = rect.width;
    const height = rect.height;
    if (width < 44 || height < 44) {
        report("WARNING: Touch target too small: " + width + "x" + height + " on " + button.textContent);
    }
}
```

---

## Test Case 4: Accessibility Bug

**Title**: Interactive elements missing accessible names

**Priority**: High (a11y is critical)

### Preconditions
1. Angular app running at http://localhost:4200
2. Chrome DevTools MCP connected
3. All pages tested

### Test Steps

| Step | Action | Expected Result | DevTools Checks |
|------|--------|----------------|-----------------|
| 1 | Get accessibility tree | Full a11y tree retrieved | Tool: get_accessibility_tree() |
| 2 | Find all interactive elements | buttons, links, inputs, etc. | query_selector_all("button, a, input, [role*='menu']") |
| 3 | Check each element has accessible name | get_accessible_name() returns non-empty | For each element: verify name exists |
| 4 | Check heading hierarchy | h1 → h2 → h3 (no skipped levels) | query_selector_all("h1-h6"), verify order |
| 5 | Tab through page | Logical focus order | test_keyboard_navigation() |
| 6 | Check color contrast | Text meets 4.5:1 ratio (WCAG AA) | get_computed_style for text elements |

### Pass/Fail Criteria
- ✅ Pass: All interactive elements have accessible names, heading hierarchy correct, focus order logical, color contrast adequate
- ❌ Fail: Any element missing accessible name, heading levels skipped, focus order illogical, contrast ratio insufficient

### DevTools MCP Commands Pattern
```javascript
// Step 1 - Get accessibility tree
const a11yTree = get_accessibility_tree();

// Step 2 & 3 - Check all interactive elements
const interactiveElements = query_selector_all("button, a, input, textarea, [role*='select'], [role*='checkbox']");

let elementsWithoutName = [];
for (const element of interactiveElements) {
    const accessibleName = get_accessible_name(element: element);
    if (accessibleName.trim().length === 0) {
        const tagName = element.tagName.toLowerCase();
        const role = element.getAttribute("role");
        elementsWithoutName.push({
            element: tagName + (role ? " [role=" + role + "]" : ""),
            selector: element_selector(element)
        });
    }
}

if (elementsWithoutName.length > 0) {
    report("FAIL: " + elementsWithoutName.length + " interactive elements without accessible names:");
    for (const el of elementsWithoutName.slice(0, 10)) {  // Show first 10
        report("  - " + el.element + " (" + el.selector + ")");
    }
}

// Step 4 - Check heading hierarchy
const headings = query_selector_all("h1, h2, h3, h4, h5, h6");
let previousLevel = 0;
let headingIssues = [];

for (const heading of headings) {
    const tag = heading.tagName.toLowerCase();
    const level = parseInt(tag.slice(1), 10);
    if (level > previousLevel + 1) {
        headingIssues.push({
            element: heading.outerHTML,
            issue: "Skipped from h" + previousLevel + " to h" + level
        });
    }
    previousLevel = level;
}

if (headingIssues.length > 0) {
    report("FAIL: Heading hierarchy issues found:");
    for (const issue of headingIssues) {
        report("  - " + issue.issue);
    }
}
```

---

## Test Case 5: Network/ API Bug

**Title**: API calls returning incorrect data or failing

**Priority**: High

### Preconditions
1. Angular app running at http://localhost:4200
2. API server running on port 8099
3. Chrome DevTools MCP connected with network monitoring

### Test Steps

| Step | Action | Expected Result | DevTools Checks |
|------|--------|----------------|-----------------|
| 1 | Trigger action that makes API call | Action initiates request | Console: no initiation errors |
| 2 | Check request details | URL, method, headers correct | Network: request URL matches expected<br>Headers: Content-Type, Authorization correct |
| 3 | Verify response status | 200 OK or appropriate error | Network: response status code |
| 4 | Inspect response body | Data matches TypeScript interface | Network: response body structure<br>Type check: matches expected schema |
| 5 | Check timing | Request completes in reasonable time | Timing: waitTime, blockingTime, DOMContentLoaded |
| 6 | Repeat action | No duplicate requests (unless expected) | Network: request count matches expectation |

### Pass/Fail Criteria
- ✅ Pass: All API calls return 200 (or expected error), response data matches schema, no unexpected duplicate requests, timing acceptable
- ❌ Fail: Any 4xx/5xx response, data shape mismatch, duplicate requests when not expected, timeout issues

### DevTools MCP Commands Pattern
```javascript
// Step 1 - Start network monitoring and trigger action
start_network_monitoring();
click_element("#load-patients");

// Step 2 & 3 - Get and analyze network events
const networkEvents = get_network_events();

// Filter for patient API calls
const patientRequests = filter_by_url_pattern(networkEvents, "/api/patients");

if (patientRequests.length === 0) {
    report("FAIL: No patient API requests found");
} else {
    for (const request of patientRequests) {
        // Check status
        if (request.response.status !== 200) {
            report("FAIL: Patient API returned status " + request.response.status);
        }
        
        // Check timing
        const timing = request.timing;
        if (timing.requestTime > 5000) {  // 5 second threshold
            report("WARNING: Patient API slow: " + timing.requestTime + "ms");
        }
        
        // Inspect response body shape
        const responseBody = request.response.body;
        if (!hasRequiredFields(responseBody, ["id", "name", "status"])) {
            report("WARNING: Patient response missing required fields");
        }
        
        // Check headers
        const contentType = request.response.headers["content-type"];
        if (!contentType || !contentType.includes("application/json")) {
            report("WARNING: Unexpected content type: " + contentType);
        }
    }
}

// Step 5 - Check for duplicate requests
const uniqueUrls = new Set(patientRequests.map(r => r.request.url));
if (uniqueUrls.size < patientRequests.length) {
    report("WARNING: Duplicate patient API requests detected");
}
```

---

## Test Case 6: Performance Bug

**Title**: Page load too slow or long tasks present

**Priority**: Medium

### Preconditions
1. Angular app running at http://localhost:4200
2. Fresh page load (no cached data)
3. Chrome DevTools MCP with performance tracing enabled

### Test Steps

| Step | Action | Expected Result | DevTools Checks |
|------|--------|----------------|-----------------|
| 1 | Start performance trace | Trace recording begins | Tool: start_performance_trace(duration_ms) |
| 2 | Fresh page load | Page loads from scratch | Network: initial navigation |
| 3 | Stop trace after 10s | Trace captured | Tool: stop_performance_trace() |
| 4 | Analyze LCP | Largest Contentful Paint < 2.5s | Metric: lcp timing |
| 5 | Analyze CLS | Cumulative Layout Shift < 0.1 | Metric: cls score |
| 6 | Analyze INP | Interaction to Next Paint < 200ms | Metric: inp timing |
| 7 | Find long tasks | No tasks > 50ms blocking main thread | List: long_tasks > 50ms |
| 8 | Identify render bottlenecks | No unnecessary re-renders | Profile: component render times |

### Pass/Fail Criteria
- ✅ Pass: LCP < 2.5s, CLS < 0.1, INP < 200ms, no long tasks > 50ms, no render bottlenecks
- ❌ Fail: Any metric exceeds thresholds, long tasks present, performance regressions

### DevTools MCP Commands Pattern
```javascript
// Step 1 - Start performance trace
start_performance_trace(duration_ms = 10000);

// Step 2 - Fresh page load (navigate to clean state)
navigate_page(url = "http://localhost:4200");

// Step 3 - Stop trace
const trace = stop_performance_trace();

// Step 4 - Get LCP (Largest Contentful Paint)
const lcp = get_largest_contentful_paint(trace);
if (lcp > 2500) {
    report("FAIL: LCP is " + lcp + "ms, expected < 2500ms");
} else {
    report("PASS: LCP is " + lcp + "ms");
}

// Step 5 - Get CLS (Cumulative Layout Shift)
const cls = get_cumulative_layout_shift(trace);
if (cls > 0.1) {
    report("FAIL: CLS is " + cls + ", expected < 0.1");
} else {
    report("PASS: CLS is " + cls);
}

// Step 6 - Get INP (Interaction to Next Paint)
const inp = get_interaction_to_next_paint(trace);
if (inp > 200) {
    report("FAIL: INP is " + inp + "ms, expected < 200ms");
} else {
    report("PASS: INP is " + inp + "ms");
}

// Step 7 - Find long tasks (> 50ms)
const longTasks = find_long_tasks(trace, threshold_ms = 50);
if (longTasks.length > 0) {
    report("WARNING: Found " + longTasks.length + " long tasks:");
    for (const task of longTasks) {
        report("  - " + task.duration + "ms at " + task.startTime);
    }
} else {
    report("PASS: No long tasks found");
}
```