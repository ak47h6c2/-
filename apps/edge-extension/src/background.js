chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    careerPilotApiBase: "http://localhost:3000"
  });
});
