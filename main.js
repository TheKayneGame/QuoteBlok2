require('dotenv').config()
const Discord = require('discord.js');
const client = new Discord.Client();
const sqlite = require('sqlite3');



const db = new sqlite.Database('./databases/viper.db');

// 1rst operation (run create table statement)
db.run(`CREATE TABLE IF NOT EXISTS quotes
        (
            quote_id INTEGER PRIMARY KEY AUTOINCREMENT,
            server_id INTEGER,
            user_id INTEGER,
            message_id INTEGER,
            quote TEXT,
            time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
    if (err) {
        console.log(err);
        throw err;
    }
});

const prefix = "$";

function quoteUnMention(quote, server) {
    const regex = /<@[&!](.+?)>/gm
    var quoteBuff = quote
    let regexquote = quote.matchAll(regex);
    regexquote = Array.from(regexquote);
    
    regexquote.forEach(match => {
        quote = quote.replace(match[0], server.members.cache.get(match[1]).user.username);
    });

    return quote;
}

function quoteAdd (serverID, userID, msgID, quote) {
    db.run(`INSERT INTO quotes(server_id, user_id, message_id, quote)
            VALUES (?, ?, ?, ?)`,
            [serverID, userID, msgID, quote], function (err) {
        if (err) {
            return console.log(err.message);
        }
    });
}

function quoteCount (serverID, callback) {
    db.get(`SELECT COUNT(quote_id) as count
                FROM quotes
                WHERE server_id=?`, [serverID], function (err, count) {
                    callback(count.count)
    });
    
}

function QuoteManager() {
}

QuoteManager.prototype = {
    do: function (name) {
        var args = Array.from(arguments).slice(1);
        var fnName = '_' + name;
        if (this[fnName]) {
            this[fnName](args);
        }
    },

    /*Create*/
    _quoteadd: function (item) {
        //console.log(item);
        const server = item[0].guild;
        const user = item[0].author;
        const msg = item[0];
        
        var quote = item[1].join(' ');

        if (!quote || quote.length > 1500) {
            return msg.reply(`Ga nie hè`);
        }

        quote = quoteUnMention(quote, server);
        quoteAdd(server.id, user.id, msg.id, quote);

        msg.reply(`Citaat: \`${quote}\` is toegevoegd aan de server`);     
    },
    
    /*Delete*/
    _quotedelete: async function (item) {
        const message = item[0];
        const server = item[0].guild;
        const user = item[0].author;
        const channel = item[0].channel;
        const index = item[1][0];
        const filter = m => m.author.id === message.author.id;
        if (isNaN(index) || index < 0) {
            channel.send("Jonguh");
            return;
        }

        let count = quoteCount(server.id);
        
        console.log(count);
        
        db.get(`SELECT COUNT(quote_id) as count
                FROM quotes
                WHERE server_id=?`, [server.id], function (err, row) {
            if (row.count < 1 || index > row.count) {
                return channel.send("Ongeldig nummer");
            } else {
                message.reply(`Bevestig door \"BEVESTIG ${index}\" te reageren`);
                channel.awaitMessages(filter, {
                    max: 1,
                    time: 10000,
                    errors: ['time']
                }).then(collected => {
                    if (collected.first().content === `BEVESTIG ${index}`) {
                        /*
                        db.get(`SELECT quote_id FROM quotes WHERE server_id=? ORDER BY quote_id LIMIT ?,1; `, [server.id, index],function(err, row) {
                            const quoteid = row.quote_id;
                            db.run(`DELETE FROM quotes WHERE quote_id=?`, [quoteid],function(err){
                                if (err) {
                                    return console.log(err.message);
                                }
                            });
                        });
                        */

                        db.get(`DELETE
                                FROM quotes
                                WHERE quote_id = (SELECT quote_id FROM quotes WHERE server_id = ? LIMIT ?
                                    , 1); `, [server.id, index], function (err, row) {

                            if (err) {
                                return console.log(err.message);
                            }
                        });

                        message.reply("Citaat verwijderd");
                    }
                })

            }
        });




    },

    _quoteedit: function (item) {
        const server = item[0].guild;
        const user = item[0].author;
        const channel = item[0].channel;

    },
    /*Read*/
    _quotes: function (item) {

        const server = item[0].guild;
        const user = item[0].author;
        const channel = item[0].channel;
        //const quote     = item[3].join();
        var messageBuffer = "";
        db.all(`SELECT user_id, quote
                FROM quotes
                WHERE server_id = ?`, [server.id], function (err, rows) {
            var i = 0;
            rows.forEach(function (row) {
                console.log(messageBuffer.length + row.quote.length);
                quoteBuffer = i++ + '. ' + row.quote + '\n';
                if (messageBuffer.length + quoteBuffer.length > 2000) {
                    channel.send(messageBuffer);
                    messageBuffer = "";
                }
                messageBuffer += quoteBuffer;

            })

            if (rows.length === 0) {
                messageBuffer = "Wollah geen citaten";
            }
            channel.send(messageBuffer);
        });
    },

    _quote: function (item) {
        const server = item[0].guild;
        const user = item[0].author;
        const channel = item[0].channel;
        let quoteIndex = item[1][0] || -1;


        if (isNaN(quoteIndex)) {
            channel.send("Geen getal");
            return;
        }

        db.get(`SELECT COUNT(quote_id) as count
                FROM quotes
                WHERE server_id=?`, [server.id], function (err, row) {
            if (row.count < 1) {
                channel.send("Geen citaten bekend");
                return;
            }

            if (quoteIndex > row.count) {
                channel.send("Ongeldig getal");
                return;
            }

            if (quoteIndex < 0) {
                quoteIndex = Math.floor(Math.random() * row.count);
                console.log(quoteIndex);
            }

            db.get(`SELECT quote
                    FROM quotes
                    WHERE server_id = ?
                    ORDER BY quote_id LIMIT ?,1`, [server.id, quoteIndex], function (err, row) {
                if (err) {
                    return console.log(err.message);
                }
                const quoteBuffer = quoteIndex + '. ' + row.quote + '\n';
                quoteIndex++;
                channel.send(quoteBuffer)

            });


        });

    },

};

const quoteManager = new QuoteManager();

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('message', msg => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;
    const args = msg.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    quoteManager.do(command, msg, args);
});

client.on('messageUpdate', (oldMsg,newMsg) => {
    console.log(oldMsg.content);
    console.log(newMsg.content);
    if (!newMsg.content.startsWith(prefix) || msg.author.bot) return;

});
client.login(process.env.BOT_TOKEN);