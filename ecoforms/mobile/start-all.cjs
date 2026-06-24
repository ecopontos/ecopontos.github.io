const concurrently = require('concurrently');

const { result } = concurrently([
    { command: 'npm run serve', name: 'MOBILE', prefixColor: 'blue' },
    { command: 'cd desktop && npm run dev', name: 'ADMIN', prefixColor: 'magenta' }
], {
    prefix: 'name',
    killOthers: ['failure', 'success'],
    restartTries: 3,
});

result.then(
    function onSuccess(exitInfo) {
        process.exit();
    },
    function onFailure(exitInfo) {
        process.exit();
    }
);
