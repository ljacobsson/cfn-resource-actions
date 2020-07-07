import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Code handler parsers tests', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('DotNetParser', () => {
		assert.equal("project/folder/class.cs", "projectname::project.folder.class::method");
	});
});
